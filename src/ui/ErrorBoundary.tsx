import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
          <div className="t-h2 text-ink">界面出了点问题</div>
          <p className="max-w-[420px] break-all text-[12px] leading-[1.7] text-ink-2">
            {String(this.state.error.message || this.state.error)}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
