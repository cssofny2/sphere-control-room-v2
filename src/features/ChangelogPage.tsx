import { memo, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Calendar, GitCommitHorizontal, History, Search, Tag, X } from 'lucide-react';
import { APP_VERSION, BUILD_DATE, COMMIT, VERSION_LABEL } from '../siteInfo';
import {
  countChanges,
  filterReleases,
  getLatestRelease,
  orderReleases,
  type SortOrder,
} from './changelog';
import { CHANGELOG_RELEASES } from './changelogData';
import { InlineFormattedText } from './InlineMarkdown';

const CATEGORY_TONE: Record<string, string> = {
  Added: 'border-sky-500/40 bg-sky-950/60 text-sky-200',
  Changed: 'border-amber-500/40 bg-amber-950/60 text-amber-200',
  Fixed: 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200',
  Security: 'border-rose-500/40 bg-rose-950/60 text-rose-200',
};

/** Site version identity and full chronological changelog driven by CHANGELOG.md. */
export const ChangelogPage = memo(function ChangelogPage() {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [scope, setScope] = useState<'all' | 'latest'>('all');
  const [query, setQuery] = useState('');

  const latestRelease = useMemo(
    () => getLatestRelease(CHANGELOG_RELEASES, APP_VERSION),
    [],
  );

  const visibleReleases = useMemo(() => {
    const filtered = filterReleases(CHANGELOG_RELEASES, {
      query,
      onlyVersion: scope === 'latest' ? latestRelease?.version ?? APP_VERSION : null,
    });
    return orderReleases(filtered, sortOrder);
  }, [query, scope, sortOrder, latestRelease]);

  const totalReleases = CHANGELOG_RELEASES.length;
  const totalChanges = useMemo(() => countChanges(CHANGELOG_RELEASES), []);
  const shownChanges = useMemo(() => countChanges(visibleReleases), [visibleReleases]);

  return (
    <div className="changelog-shell space-y-4 p-2 sm:p-4" data-changelog-page aria-label="Site version and chronological changelog">
      <section className="changelog-hero rounded-lg border border-slate-700/80 p-4 sm:p-5" aria-labelledby="site-version-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-sky-300">
              <History size={15} aria-hidden="true" />
              <span>Site Release &amp; Change History</span>
            </div>
            <h1 id="site-version-heading" className="text-xl font-bold tracking-tight text-zinc-100">
              S.P.H.E.R.E. Metrology Lab{' '}
              <span className="font-mono text-sky-300" data-changelog-current-version>
                {VERSION_LABEL}
              </span>
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-zinc-300 sm:text-sm">
              Current version identifier and chronological record of site updates, instrument upgrades, protocol additions, and fixes.
            </p>
          </div>

          <div className="changelog-version-plate" aria-label={`Current site version ${APP_VERSION}`}>
            <span className="changelog-version-kicker">Current Version</span>
            <strong className="changelog-version-number">{VERSION_LABEL}</strong>
            {latestRelease?.date && (
              <span className="changelog-version-meta">
                Released <time dateTime={latestRelease.date}>{latestRelease.date}</time>
              </span>
            )}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-700/70 pt-3 text-xs sm:grid-cols-4">
          <div className="changelog-stat">
            <dt className="text-zinc-400">Semantic version</dt>
            <dd className="mt-0.5 font-mono font-semibold text-zinc-100">{APP_VERSION}</dd>
          </div>
          <div className="changelog-stat">
            <dt className="flex items-center gap-1 text-zinc-400">
              <Calendar size={12} aria-hidden="true" /> Release date
            </dt>
            <dd className="mt-0.5 font-mono font-semibold text-zinc-100">
              {latestRelease?.date ?? BUILD_DATE ?? '—'}
            </dd>
          </div>
          <div className="changelog-stat">
            <dt className="flex items-center gap-1 text-zinc-400">
              <GitCommitHorizontal size={12} aria-hidden="true" /> Build
            </dt>
            <dd className="mt-0.5 font-mono font-semibold text-zinc-100">
              {BUILD_DATE || 'local'}
              {COMMIT && COMMIT !== 'local' ? ` · ${COMMIT}` : ''}
            </dd>
          </div>
          <div className="changelog-stat">
            <dt className="flex items-center gap-1 text-zinc-400">
              <Tag size={12} aria-hidden="true" /> History tracked
            </dt>
            <dd className="mt-0.5 font-mono font-semibold text-zinc-100">
              {totalReleases} releases · {totalChanges} entries
            </dd>
          </div>
        </dl>
      </section>

      <section className="changelog-controls rounded-lg border border-slate-700/80 p-3" aria-label="Changelog display controls">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Chronological list order">
            <button
              type="button"
              role="radio"
              aria-checked={sortOrder === 'newest'}
              onClick={() => setSortOrder('newest')}
              className={`changelog-toggle ${sortOrder === 'newest' ? 'is-active' : ''}`}
            >
              <ArrowDownWideNarrow size={14} aria-hidden="true" />
              <span>Newest first</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={sortOrder === 'oldest'}
              onClick={() => setSortOrder('oldest')}
              className={`changelog-toggle ${sortOrder === 'oldest' ? 'is-active' : ''}`}
            >
              <ArrowUpNarrowWide size={14} aria-hidden="true" />
              <span>Oldest first</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Release scope">
            <button
              type="button"
              role="radio"
              aria-checked={scope === 'latest'}
              onClick={() => setScope('latest')}
              className={`changelog-toggle ${scope === 'latest' ? 'is-active' : ''}`}
            >
              <span>Latest ({VERSION_LABEL})</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scope === 'all'}
              onClick={() => setScope('all')}
              className={`changelog-toggle ${scope === 'all' ? 'is-active' : ''}`}
            >
              <span>All releases ({totalReleases})</span>
            </button>
          </div>

          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Filter changes by keyword, version, or date"
              placeholder="Filter changes (e.g. VNA, LOC-1, 2026-11)..."
              className="w-full rounded border border-slate-600 bg-slate-950/90 py-1.5 pl-8 pr-8 text-xs text-zinc-100 placeholder:text-zinc-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear changelog filter"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-100"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400" role="status" aria-live="polite">
          Showing {shownChanges} {shownChanges === 1 ? 'change' : 'changes'} across {visibleReleases.length}{' '}
          {visibleReleases.length === 1 ? 'release' : 'releases'} in{' '}
          {sortOrder === 'newest' ? 'reverse chronological (newest first)' : 'chronological (oldest first)'} order.
        </p>
      </section>

      {visibleReleases.length === 0 ? (
        <div className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-6 text-center text-sm text-zinc-300">
          No changelog entries match “{query}”.{' '}
          <button type="button" onClick={() => { setQuery(''); setScope('all'); }} className="ml-1 text-sky-300 underline hover:text-sky-200">
            Show all changes
          </button>
        </div>
      ) : (
        <ol className="changelog-release-list space-y-4" aria-label="Chronological release history">
          {visibleReleases.map(release => {
            const isCurrent = release.version === APP_VERSION;
            return (
              <li key={release.version} className="list-none">
                <article
                  className={`changelog-release rounded-lg border p-4 ${isCurrent ? 'border-sky-500/50' : 'border-slate-700/80'}`}
                  aria-labelledby={`release-${release.version}`}
                >
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 id={`release-${release.version}`} className="font-mono text-base font-bold text-zinc-100">
                        {release.isUnreleased ? release.version : `v${release.version}`}
                      </h2>
                      {isCurrent && (
                        <span className="rounded border border-sky-400/60 bg-sky-950/80 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
                          Current release
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs text-zinc-400">
                      {release.date ? (
                        <time dateTime={release.date}>{release.date}</time>
                      ) : (
                        <span>Initial release</span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {release.entries.length} {release.entries.length === 1 ? 'change' : 'changes'}
                      </span>
                    </div>
                  </header>

                  <ol className="changelog-entry-list mt-3 space-y-2.5" aria-label={`Changes in ${release.isUnreleased ? release.version : `version ${release.version}`}`}>
                    {release.entries.map(entry => (
                      <li key={entry.id} className="changelog-entry">
                        <div className="changelog-entry-meta">
                          {entry.date && (
                            <time dateTime={entry.date} className="changelog-entry-date">
                              {entry.date}
                            </time>
                          )}
                          {entry.category && (
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_TONE[entry.category] ?? 'border-slate-600 bg-slate-900 text-zinc-300'}`}>
                              {entry.category}
                            </span>
                          )}
                        </div>
                        <p className="changelog-entry-body">
                          <InlineFormattedText text={entry.text} />
                        </p>
                      </li>
                    ))}
                  </ol>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
});
