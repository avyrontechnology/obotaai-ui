"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}


export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-10 relative overflow-hidden rounded-[2.5rem] border border-red-500/20 bg-red-500/5 backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15)_0%,transparent_70%)] pointer-events-none" />
          <div className="relative z-10 w-24 h-24 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.2)] backdrop-blur-md">
            <AlertCircle className="w-10 h-10 text-red-500" strokeWidth={1.5} />
          </div>
          <div className="text-center relative z-10 space-y-3 max-w-lg">
            <h2 className="text-3xl font-medium tracking-tight text-foreground">Something went wrong</h2>
            <p className="font-mono text-sm leading-relaxed text-red-600/80 dark:text-red-400/80">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="relative z-10 flex items-center gap-2 px-8 py-3 mt-4 rounded-xl bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:bg-red-700 transition-all font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
