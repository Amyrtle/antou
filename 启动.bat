@echo off
setlocal
cd /d "%~dp0"
title 案头 antou

echo.
echo   案头 antou - 本地启动
echo   ========================================
echo   当前目录: %CD%
echo.

rem ---- 1. 找 Python ----
set "PY="
python --version >nul 2>&1 && set "PY=python"
if not defined PY (
  py -3 --version >nul 2>&1 && set "PY=py -3"
)
if not defined PY goto NOPY

rem ---- 2. 没有构建产物就先构建 ----
if exist "dist\index.html" goto RUN
if not exist "package.json" goto NODIST

echo   没找到 dist\index.html，尝试构建...
where npm >nul 2>&1
if errorlevel 1 goto NONPM
if not exist "node_modules" (
  echo   正在安装依赖，国内网络可能要几分钟...
  call npm install
)
call npm run build
if not exist "dist\index.html" goto BUILDFAIL

:RUN
echo.
%PY% -u serve.py --port 8000 --open
echo.
echo   服务已退出。
pause
exit /b 0

:NOPY
echo   [x] 没找到 Python。请先安装 Python 3.9 或更高版本，
echo       安装时务必勾选 "Add python.exe to PATH"。
echo       下载地址: https://www.python.org/downloads/windows/
echo.
pause
exit /b 1

:NODIST
echo   [x] 当前目录既没有 dist\ 也没有 package.json，压缩包可能没解压完整。
echo       请重新解压，或把 dist 目录一起拷过来。
echo.
pause
exit /b 1

:NONPM
echo   [x] 没有 dist\ 产物，也没找到 npm，无法构建。
echo       请把完整的 dist 目录一起拷过来，或先安装 Node.js。
echo.
pause
exit /b 1

:BUILDFAIL
echo   [x] 构建失败，请看上面的报错信息。
echo.
pause
exit /b 1
