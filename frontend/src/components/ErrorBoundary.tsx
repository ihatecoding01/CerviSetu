import { Component, type ErrorInfo, type ReactNode } from "react";

/** A crash shows a message or a quiet fallback, never a white page. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode; name: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div role="alert" data-testid="app-error" className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-6 font-sans">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold">CerviSetu could not open this page</h1>
          <p className="mt-2 text-sm text-slate-600">Please reload. If it happens again, share the details below with support.</p>
          <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-xs whitespace-pre-wrap break-words">{this.state.error.message}</pre>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white cursor-pointer">Reload</button>
        </div>
      </div>
    );
  }
}
