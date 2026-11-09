#!/usr/bin/env python3
"""案头 antou —— 本地静态服务

用法:
    python serve.py                 # 托管 dist/，端口 8000
    python serve.py --port 5173     # 指定端口
    python serve.py --dir dist --open   # 指定目录并打开应用窗口
    python serve.py --dev           # 托管项目根目录（开发用，走 index.html 之前的源码不行，请先 npm run build）
"""

import argparse
import http.server
import os
import socket
import socketserver
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# 控制台编码千奇百怪（936 / 65001 / 437），出错不能让服务起不来
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="replace")
    except (AttributeError, ValueError):
        pass


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    """静态服务 + SPA 回退：找不到的路径一律回 index.html。"""

    def __init__(self, *args, directory: str, **kwargs):
        self._directory = directory
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self):
        # 开发期禁缓存，改完刷新即生效
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) and "." not in os.path.basename(path):
            self.path = "/index.html"
        return super().send_head()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def port_in_use(host: str, port: int) -> bool:
    """端口是否已经有别的服务在监听（Windows 上 SO_REUSEADDR 会让绑定成功但请求打到别人那）"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex((host, port)) == 0


def free_port(preferred: int, host: str) -> int:
    if not port_in_use(host, preferred):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, preferred))
                return preferred
            except OSError:
                pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, 0))
        return s.getsockname()[1]


def is_antou(host: str, port: int, timeout: float = 6.0) -> bool:
    """探测某个端口上跑的是不是案头（用于跳过 8000 这种常被别的项目占着的端口）。"""
    import urllib.request

    try:
        with urllib.request.urlopen(f"http://{host}:{port}/", timeout=timeout) as r:
            if r.status != 200:
                return False
            body = r.read(65536).decode("utf-8", "ignore")
        return "案头" in body
    except Exception:  # noqa: BLE001
        return False


def pick_port(preferred: int, host: str) -> tuple[int, str]:
    """返回 (端口, 提示语)。端口被占时换空闲端口，并明确告诉用户为什么会换。"""
    if not port_in_use(host, preferred):
        return free_port(preferred, host), ""
    # 端口被占：如果占它的是我们自己（上一次没关干净），直接用这个端口最省事
    if is_antou(host, preferred):
        return preferred, f"端口 {preferred} 上已经有一个案头在跑，直接复用它。"
    port = free_port(preferred, host)
    return port, f"端口 {preferred} 被其它程序占用，已自动换到 {port}。"


def open_app_window(url: str) -> bool:
    """用 Edge/Chrome 的 --app 模式开一个没有地址栏、没有标签页的窗口。

    这样它是「一个窗口」，不是「浏览器里的一个网页」：不占标签栏、没有书签栏、
    关掉窗口服务也就该退了。找不到浏览器时返回 False，让调用方退回普通方式。
    """
    if os.name != "nt":
        return False
    candidates = [
        r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe",
        r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe",
        r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe",
        r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
        r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
        r"%LocalAppData%\Google\Chrome\Application\chrome.exe",
    ]
    for raw in candidates:
        exe = os.path.expandvars(raw)
        if not os.path.exists(exe):
            continue
        try:
            subprocess.Popen(
                [exe, f"--app={url}", "--window-size=1440,900", "--start-maximized"],
                creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
            )
            return True
        except OSError:
            continue
    return False


def launch(url: str) -> None:
    """优先开应用窗口；实在没有可用的 Chromium 内核，才退回默认浏览器。"""
    if open_app_window(url):
        return
    try:
        webbrowser.open(url)
    except Exception:  # noqa: BLE001
        pass


def main() -> int:
    ap = argparse.ArgumentParser(description="案头 antou 本地服务")
    ap.add_argument("--port", type=int, default=8000, help="端口，默认 8000")
    ap.add_argument("--dir", default="dist", help="托管目录，默认 dist")
    ap.add_argument("--host", default="127.0.0.1", help="监听地址，默认 127.0.0.1")
    ap.add_argument("--open", action="store_true", help="启动后打开应用窗口（无地址栏）")
    args = ap.parse_args()

    directory = (ROOT / args.dir).resolve()
    if not directory.is_dir():
        print(f"目录不存在：{directory}\n先执行 npm run build 生成 dist/，或用 --dir 指定其它目录。")
        return 1
    if not (directory / "index.html").exists():
        print(f"{directory} 下没有 index.html，确认这个目录是前端构建产物。")
        return 1

    if port_in_use(args.host, args.port) and is_antou(args.host, args.port):
        # 已经有案头在跑：别再起一个，直接把地址告诉用户
        url = f"http://{args.host}:{args.port}/"
        print("案头 antou 已经在运行", flush=True)
        print(f"  地址：{url}", flush=True)
        if args.open:
            launch(url)
        print("  停止：关掉之前那个命令行窗口，或按 Ctrl+C", flush=True)
        return 0

    port, hint = pick_port(args.port, args.host)
    if hint:
        print(f"提示：{hint}", flush=True)
    url = f"http://{args.host}:{port}/"

    with Server((args.host, port), lambda *a, **kw: SPAHandler(*a, directory=str(directory), **kw)) as httpd:
        # 先让服务跑起来，再做自检（自检本身要发请求，服务没起来会把自己卡死）
        worker = threading.Thread(target=httpd.serve_forever, daemon=True)
        worker.start()
        time.sleep(0.3)

        # 自检：确认这个地址上跑的是我们的应用，而不是同端口的其它服务
        try:
            import urllib.request

            with urllib.request.urlopen(url, timeout=5) as r:
                body = r.read().decode("utf-8", "ignore")
            if "案头" not in body:
                print("自检失败：该地址返回的不是案头页面，请检查端口占用。", flush=True)
                httpd.shutdown()
                return 1
        except Exception as exc:  # noqa: BLE001
            print(f"自检失败：{exc}", flush=True)
            httpd.shutdown()
            return 1

        print("案头 antou 已启动", flush=True)
        print(f"  地址：{url}", flush=True)
        print(f"  目录：{directory}", flush=True)
        print("  停止：Ctrl+C（关掉这个窗口也一样）", flush=True)
        if args.open:
            threading.Timer(0.6, lambda: launch(url)).start()
        try:
            while worker.is_alive():
                worker.join(0.5)
        except KeyboardInterrupt:
            print("\n已停止。", flush=True)
            httpd.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
