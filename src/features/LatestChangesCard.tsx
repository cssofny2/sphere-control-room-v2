import { memo, useMemo } from 'react';
import { ArrowRight, History } from 'lucide-react';
import { APP_VERSION, VERSION_LABEL } from '../siteInfo';
import { getLatestChanges, getLatestRelease } from './changelog';
import { CHANGELOG_RELEASES } from './changelogData';
import { InlineFormattedText } from './InlineMarkdown';

type Props = {
  onOpenChangelog: () => void;
  limit?: number;
};

/** Compact Operator Dashboard card showing the site version number and latest changes in chronological order. */
export const LatestChangesCard = memo(function LatestChangesCard({ onOpenChangelog, limit = 5 }: Props) {
  const latestRelease = useMemo(
    () => getLatestRelease(CHANGELOG_RELEASES, APP_VERSION),
    [],
  );
  const recent = useMemo(
    () => getLatestChanges(CHANGELOG_RELEASES, limit, APP_VERSION),
    [limit],
  );

  if (!recent.length) return null;

  return (
    <section
      className="latest-changes-card rounded-lg border border-slate-700/80 p-4"
      data-latest-changes
      aria-labelledby="latest-changes-heading"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/70 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <History size={16} className="text-sky-300" aria-hidden="true" />
          <h2 id="latest-changes-heading" className="text-sm font-bold text-zinc-100">
            Site Version &amp; Latest Changes
          </h2>
          <span className="rounded-full border border-sky-500/50 bg-sky-950/70 px-2 py-0.5 font-mono text-xs font-semibold text-sky-200">
            {VERSION_LABEL}
          </span>
          {latestRelease?.date && (
            <time dateTime={latestRelease.date} className="font-mono text-xs text-zinc-400">
              {latestRelease.date}
            </time>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenChangelog}
          className="chrome-button text-xs"
        >
          <span>Full chronological log</span>
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>

      <ol className="mt-3 space-y-2" aria-label={`Latest changes in version ${APP_VERSION}`}>
        {recent.map(entry => (
          <li key={entry.id} className="latest-changes-row">
            {entry.date && (
              <time dateTime={entry.date} className="changelog-entry-date">
                {entry.date}
              </time>
            )}
            <span className="text-xs leading-relaxed text-zinc-300">
              <InlineFormattedText text={entry.text} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
});
