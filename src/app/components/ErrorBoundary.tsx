import React, { Component, ErrorInfo, ReactNode } from "react";
import { ProjTrackLogo } from "./brand/ProjTrackLogo";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    // TODO: send to your error reporting service (Sentry, etc.)
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
          <div className="max-w-md text-center">
            <div className="flex justify-center mb-6">
              <ProjTrackLogo role="admin" compact={false} />
            </div>
            <h1 className="text-3xl font-semibold mb-4">Something went wrong</h1>
            <p className="text-slate-400 mb-6">An unexpected error occurred. Our team has been notified.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-medium"
            >
              Reload Application
            </button>
            <p className="mt-8 text-xs text-slate-500">Error ID: {Date.now().toString(36)}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
