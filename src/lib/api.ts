import { useSettings, type ThinkingTier } from '../store/settings'
import { useApiLog } from '../store/api'
import { uid } from './id'

/** 统一错误码表，见 docs/API_SPEC.md §1.3 */
export const ERROR_TABLE: Record<number, { hint: string; retryable: boolean; fallbackLocal: boolean }> = {
  0: { hint: '成功', retryable: false, fallbackLocal: false },
  40001: { hint: '参数校验失败', retryable: false, fallbackLocal: false },
  40002: { hint: '请求体过大，请拆分文件', retryable: false, fallbackLocal: false },
  40100: { hint: '未登录或 token 无效', retryable: false, fallbackLocal: false },
  40101: { hint: '权限不足', retryable: false, fallbackLocal: false },
  40200: { hint: '额度不足，可切回本地模式', retryable: false, fallbackLocal: true },
  40300: { hint: '命中内容安全策略，换个说法', retryable: false, fallbackLocal: false },
  40400: { hint: '资源不存在', retryable: false, fallbackLocal: false },
  40900: { hint: '重复请求，已幂等回放', retryable: false, fallbackLocal: false },
  42201: { hint: '语义错误（如 PDF 无文本层）', retryable: false, fallbackLocal: false },
  42901: { hint: '触发限流，稍后再试', retryable: true, fallbackLocal: true },
  42902: { hint: '上游限流', retryable: true, fallbackLocal: true },
  50000: { hint: '服务内部错误', retryable: true, fallbackLocal: false },
  50010: { hint: '上游超时', retryable: true, fallbackLocal: true },
  50011: { hint: '上游返回异常', retryable: true, fallbackLocal: true },
  50012: { hint: '上游返回格式不合法', retryable: true, fallbackLocal: true },
  50300: { hint: '服务维护中', retryable: true, fallbackLocal: false },
}

/** 思考强度档位规格，见 docs/MODEL_PARAMS.md §5.2 */
export const TIER_SPEC: Record<
  ThinkingTier,
  { label: string; budget: number; timeoutMs: number; maxTokens: number; scene: string; cost: string }
> = {
  off: { label: '关', budget: 0, timeoutMs: 20_000, maxTokens: 1200, scene: '事实型提问，追求秒回', cost: '最省' },
  low: { label: '低', budget: 1024, timeoutMs: 30_000, maxTokens: 1400, scene: '默认档，差异对比、归纳够用', cost: '较省' },
  medium: { label: '中', budget: 4096, timeoutMs: 60_000, maxTokens: 1800, scene: '多步推理：为什么两者矛盾', cost: '中等' },
  high: { label: '高', budget: 16384, timeoutMs: 120_000, maxTokens: 2000, scene: '跨论文方法论对齐、找矛盾', cost: '更准也更慢更贵' },
}

export class ApiError extends Error {
  code: number
  status: number
  requestId: string
  retryAfterMs: number | null
  retryable: boolean
  fallbackLocal: boolean
  constructor(opts: { code: number; status: number; message: string; requestId: string; retryAfterMs?: number | null }) {
    const meta = ERROR_TABLE[opts.code] ?? { hint: opts.message, retryable: opts.status >= 500 || opts.status === 429, fallbackLocal: opts.status >= 500 }
    super(opts.message || meta.hint)
    this.name = 'ApiError'
    this.code = opts.code
    this.status = opts.status
    this.requestId = opts.requestId
    this.retryAfterMs = opts.retryAfterMs ?? null
    this.retryable = meta.retryable
    this.fallbackLocal = meta.fallbackLocal
  }
}

type Envelope<T> = { code?: number; message?: string; data?: T; details?: Record<string, unknown>; request_id?: string }

const BACKOFF_MS = [1000, 3000]
const jitter = (ms: number) => ms * (0.8 + Math.random() * 0.4)
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    }, { once: true })
  })

function readRateLimit(res: Response): string | null {
  const rem = res.headers.get('X-RateLimit-Remaining')
  const lim = res.headers.get('X-RateLimit-Limit')
  return lim ? `${rem ?? '?'}/${lim}` : null
}

/**
 * 统一请求入口：包络解析、错误码翻译、429/5xx 退避重试（最多 2 次）、按档超时、调用日志。
 * 网关模式走 /api/v1/*（包络），直连模式走模型厂商（无包络，按 code=0 处理）。
 */
export async function apiRequest<T>(opts: {
  path: string
  method?: 'GET' | 'POST'
  body?: unknown
  tier?: ThinkingTier
  signal?: AbortSignal
  idempotencyKey?: string
}): Promise<{ data: T; requestId: string; rateLimit: string | null }> {
  const settings = useSettings.getState()
  const gatewayOn = settings.gateway.enabled && settings.gateway.baseUrl.trim() !== ''
  const base = gatewayOn ? settings.gateway.baseUrl.replace(/\/$/, '') : settings.baseUrl.replace(/\/$/, '')
  const url = gatewayOn ? `${base}/api/v1${opts.path}` : `${base}${opts.path}`
  const token = gatewayOn ? settings.gateway.token.trim() : settings.apiKey.trim()
  const tier = opts.tier ?? settings.thinking
  const timeoutMs = TIER_SPEC[tier].timeoutMs
  const mode = gatewayOn ? 'gateway' : 'direct'
  const requestId = uid('req_')

  let lastError: ApiError | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0 && lastError?.retryAfterMs) await sleep(Math.min(lastError.retryAfterMs, 8000), opts.signal)
    else if (attempt > 0) await sleep(jitter(BACKOFF_MS[attempt - 1]), opts.signal)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs)
    const onAbort = () => controller.abort(new DOMException('aborted', 'AbortError'))
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    const started = Date.now()

    try {
      const res = await fetch(url, {
        method: opts.method ?? 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
          'X-Request-Id': requestId,
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      })
      const ms = Date.now() - started
      const rateLimit = readRateLimit(res)
      const raw = (await res.json().catch(() => null)) as Envelope<T> | null
      const enveloped = gatewayOn && raw && typeof raw.code === 'number'
      const code = enveloped ? (raw.code as number) : res.ok ? 0 : res.status >= 500 ? 50011 : res.status === 429 ? 42901 : 40001
      const message = enveloped ? (raw.message ?? '') : res.ok ? 'ok' : `模型服务返回 ${res.status}`
      const retryAfter = enveloped ? Number((raw.details as { retry_after_ms?: number } | undefined)?.retry_after_ms ?? NaN) : NaN

      if (code !== 0) {
        lastError = new ApiError({
          code,
          status: res.status,
          message,
          requestId: enveloped ? (raw.request_id ?? requestId) : requestId,
          retryAfterMs: Number.isFinite(retryAfter) ? retryAfter : null,
        })
        logCall({ requestId, path: opts.path, mode, tier, ok: false, status: res.status, code, ms, tokens: null, message, rate: rateLimit, attempt })
        if (lastError.retryable && attempt < 2) continue
        throw lastError
      }

      const data = (enveloped ? (raw.data as T) : (raw as T)) ?? ({} as T)
      const tokens = extractTokens(raw)
      logCall({ requestId, path: opts.path, mode, tier, ok: true, status: res.status, code: 0, ms, tokens, message: 'ok', rate: rateLimit, attempt })
      return { data, requestId: enveloped ? (raw.request_id ?? requestId) : requestId, rateLimit }
    } catch (e) {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      if (e instanceof ApiError) throw e
      const ms = Date.now() - started
      const aborted = opts.signal?.aborted
      const timedOut = !aborted && controller.signal.aborted
      const code = timedOut ? 50010 : 50000
      const message = aborted ? '已取消' : timedOut ? `上游超时（${Math.round(timeoutMs / 1000)}s）` : e instanceof Error ? e.message : '网络错误'
      if (aborted) {
        logCall({ requestId, path: opts.path, mode, tier, ok: false, status: 0, code: 0, ms, tokens: null, message, rate: null, attempt })
        throw new ApiError({ code: 0, status: 0, message, requestId })
      }
      lastError = new ApiError({ code, status: timedOut ? 504 : 500, message, requestId })
      logCall({ requestId, path: opts.path, mode, tier, ok: false, status: timedOut ? 504 : 500, code, ms, tokens: null, message, rate: null, attempt })
      if (lastError.retryable && attempt < 2) continue
      throw lastError
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
    }
  }
  throw lastError ?? new ApiError({ code: 50000, status: 500, message: '请求失败', requestId })
}

function extractTokens(raw: unknown): number | null {
  const u = (raw as { usage?: { total_tokens?: number } } | null)?.usage
  return typeof u?.total_tokens === 'number' ? u.total_tokens : null
}

function logCall(e: {
  requestId: string
  path: string
  mode: 'gateway' | 'direct'
  tier: ThinkingTier
  ok: boolean
  status: number
  code: number
  ms: number
  tokens: number | null
  message: string
  rate: string | null
  attempt: number
}) {
  useApiLog.getState().push({
    request_id: e.requestId,
    path: e.path,
    mode: e.mode,
    tier: e.tier,
    ok: e.ok,
    status: e.status,
    code: e.code,
    ms: e.ms,
    tokens: e.tokens,
    rate: e.rate,
    message: e.attempt > 0 ? `${e.message}（第 ${e.attempt + 1} 次尝试）` : e.message,
  })
}

/** 跨厂商思考参数映射，见 docs/MODEL_PARAMS.md §5.2 */
export function thinkingParams(tier: ThinkingTier, model: string): Record<string, unknown> {
  const spec = TIER_SPEC[tier]
  const openai = /^(o[134]|gpt-5|gpt-4o)/.test(model)
  if (tier === 'off') return openai ? {} : { enable_thinking: false }
  if (openai) return { reasoning_effort: tier === 'low' ? 'low' : tier }
  return { enable_thinking: true, thinking_budget: spec.budget }
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function callChat(messages: ChatMessage[], opts: { signal?: AbortSignal; json?: boolean }) {
  const settings = useSettings.getState()
  const tier = settings.thinking
  const spec = TIER_SPEC[tier]
  const body = {
    model: settings.model,
    temperature: 0.2,
    top_p: 0.8,
    seed: 7,
    repetition_penalty: 1.05,
    max_tokens: spec.maxTokens,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    ...thinkingParams(tier, settings.model),
    messages,
  }
  const { data } = await apiRequest<{
    choices?: Array<{ message?: { content?: string } }>
    usage?: { total_tokens?: number }
  }>({ path: '/chat/completions', body, tier, signal: opts.signal })
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new ApiError({ code: 50012, status: 502, message: '模型返回为空', requestId: '-' })
  return { content, tokens: data.usage?.total_tokens ?? null }
}

/** 连接测试：网关走 /usage，直连走 /models */
export async function testConnection(): Promise<string> {
  const settings = useSettings.getState()
  const gatewayOn = settings.gateway.enabled && settings.gateway.baseUrl.trim() !== ''
  try {
    if (gatewayOn) {
      const { data } = await apiRequest<unknown>({ path: '/usage', method: 'GET', tier: 'off' })
      return `网关连通 · ${JSON.stringify(data).slice(0, 60)}`
    }
    const { data } = await apiRequest<unknown>({ path: '/models', method: 'GET', tier: 'off' })
    const list = (data as { data?: Array<{ id?: string }> })?.data
    return Array.isArray(list) ? `直连可用 · ${list.length} 个模型` : '直连可用'
  } catch (e) {
    // 404 基本都是把模型厂商的 base url 填进了「网关地址」：前端还会自己拼 /api/v1
    if (gatewayOn && e instanceof ApiError && e.status === 404) {
      const base = settings.gateway.baseUrl.replace(/\/$/, '')
      throw new ApiError({
        code: 40400,
        status: 404,
        message: `网关返回 404：请求打到了 ${base}/api/v1/usage。这里要填你自己的后端根地址（不含 /api/v1），不是模型厂商地址；只想直连模型就关掉「走自建 API 网关」。`,
        requestId: '-',
      })
    }
    throw e
  }
}
