import React, { Component, ErrorInfo, ReactNode } from "react";
import { ProjTrackLogo } from "./brand/ProjTrackLogo";
import { Button } from "./ui/button";
import { buildApiUrl } from "../lib/api/runtime";
import { featureFlags } from "../lib/flags";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
  reportStatus: "idle" | "sending" | "sent" | "failed";
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, reportStatus: "idle" };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `err_${Date.now().toString(36)}`,
      reportStatus: "idle",
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    void this.reportError(error, errorInfo);
  }

  private async reportError(error: Error, errorInfo: ErrorInfo) {
    if (!featureFlags.clientErrorReporting || !this.state.errorId) {
      return;
    }

    this.setState({ reportStatus: "sending" });

    try {
      const response = await fetch(buildApiUrl("/monitoring/client-errors"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          errorId: this.state.errorId,
          message: error.message,
          stack: error.stack,
          route: typeof window === "undefined" ? undefined : window.location.pathname,
          userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
          online: typeof navigator === "undefined" ? true : navigator.onLine,
          timestamp: new Date().toISOString(),
          context: {
            componentStack: errorInfo.componentStack,
          },
        }),
      });

      this.setState({ reportStatus: response.ok ? "sent" : "failed" });
    } catch {
      this.setState({ reportStatus: "failed" });
    }
  }

  private reportToSupport = () => {
    if (this.state.error) {
      void this.reportError(this.state.error, { componentStack: "" });
    }
  }

  private retry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorId: undefined,
      reportStatus: "idle",
    });
  }

  public render() {
    if (this.state.hasError) {
      const reportMessage =
        this.state.reportStatus === "sending"
          ? "Reporting error to support..."
          : this.state.reportStatus === "sent"
            ? "Support report sent."
            : this.state.reportStatus === "failed"
              ? "Support report failed. Please reload and try again."
              : "Support report ready to send.";

      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
          <div className="max-w-xl text-center">
            <div className="flex justify-center mb-6">
              <ProjTrackLogo role="admin" compact={false} />
            </div>
            <h1 className="text-3xl font-semibold mb-4">Something went wrong</h1>
            <p className="text-slate-400 mb-4">
              An unexpected error interrupted this screen. You can retry the view,
              reload the app, or send the captured error details to support.
            </p>
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300">
              <p className="font-semibold text-white">Support status</p>
              <p className="mt-1">{reportMessage}</p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={this.retry}
                className="rounded-xl bg-white/10 px-6 text-white hover:bg-white/15"
              >
                Retry View
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={() => window.location.reload()}
                className="rounded-xl bg-blue-600 px-6 font-medium hover:bg-blue-500"
              >
                Reload Application
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={this.reportToSupport}
                disabled={this.state.reportStatus === "sending"}
                className="rounded-xl border-white/15 bg-transparent px-6 text-white hover:bg-white/8"
              >
                {this.state.reportStatus === "sending" ? "Reporting..." : "Report to Support"}
              </Button>
            </div>
            <p className="mt-6 text-xs text-slate-500">Error ID: {this.state.errorId ?? "unavailable"}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
