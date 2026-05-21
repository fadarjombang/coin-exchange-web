import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
          <div className="max-w-md">
            <p className="text-5xl mb-4">⚠️</p>
            <h1 className="text-xl font-bold text-foreground mb-2">Terjadi Kesalahan</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Aplikasi mengalami error yang tidak terduga. Silakan muat ulang halaman.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Muat Ulang
            </button>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 text-left text-xs bg-muted p-3 rounded overflow-auto max-h-40 text-destructive">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
