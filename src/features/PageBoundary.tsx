import { Component, type ReactNode } from 'react';

/**
 * Keeps a crash in one page from blanking the whole app: shows what happened and a way out instead.
 * It renders no wrapper element, so the page layout is unchanged. Changing page (the `pageKey`) clears the error.
 */
export class PageBoundary extends Component<{ pageKey: string; children: ReactNode }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.pageKey };
  static getDerivedStateFromError(error: Error) { return { error }; }
  static getDerivedStateFromProps(p: { pageKey: string }, s: { error: Error | null; key: string }) { return p.pageKey !== s.key ? { error: null, key: p.pageKey } : null; }
  componentDidCatch(error: Error) { try { console.error('Page crashed:', error); } catch { /* ignore */ } }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="m-4 rounded-lg border border-rose-500/50 bg-rose-950/40 p-4 text-sm text-rose-100">
        <div className="font-bold">This page hit an error and could not be shown.</div>
        <p className="mt-1 text-rose-200/80">Your lab and saved data are unaffected. Try another page, or reload.</p>
        <p className="mt-2 font-mono text-[11px] text-rose-200/70">{String(this.state.error.message).slice(0, 200)}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => this.setState({ error: null })} className="rounded border border-rose-400 px-3 py-1.5 hover:bg-rose-900/60">Try again</button>
          <button onClick={() => window.location.reload()} className="rounded border border-zinc-500 px-3 py-1.5 hover:bg-zinc-800">Reload</button>
        </div>
      </div>
    );
  }
}
