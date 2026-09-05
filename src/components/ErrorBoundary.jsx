import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // No crash-reporting service wired up (fully offline, local-only app) —
    // the console is the only diagnostic signal available.
    console.error('Unhandled error in screen:', error, info)
  }

  reset = () => {
    this.setState({ hasError: false })
    if (this.props.onReset) this.props.onReset()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="font-serif text-lg font-semibold">Something went wrong</div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            This screen hit an unexpected error. Your saved data is untouched — try going back.
          </div>
          <button
            onClick={this.reset}
            className="mt-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
