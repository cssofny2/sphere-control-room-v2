// Pure changelog parser and chronological helpers. Driven directly by CHANGELOG.md so the
// site version, release history and latest changes stay in sync with the repository.

export type ChangeEntry = {
  id: string;
  version: string;
  date: string | null;
  category: string | null;
  text: string;
  order: number;
};

export type ChangelogRelease = {
  version: string;
  date: string | null;
  isUnreleased: boolean;
  entries: ChangeEntry[];
};

export type SortOrder = 'newest' | 'oldest';

export type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'strong'; value: string };

const RELEASE_HEADING = /^##\s+(?:\[([^\]]+)\]|(Unreleased))(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\s*$/i;
const CATEGORY_HEADING = /^###\s+(.+?)\s*$/;
const BULLET_LINE = /^-\s+(.+)$/;
const ITEM_DATE_PREFIX = /^(?:\*\*(\d{4}-\d{2}-\d{2})\*\*|(\d{4}-\d{2}-\d{2}))\s*(?:—|--|-|:)\s*(.+)$/;

/** Parses CHANGELOG.md into structured releases and dated entries in source (newest-first) order. */
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let current: ChangelogRelease | null = null;
  let category: string | null = null;
  let order = 0;

  for (const rawLine of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const rel = RELEASE_HEADING.exec(line);
    if (rel) {
      const version = (rel[1] || rel[2] || '').trim();
      current = {
        version,
        date: rel[3] ?? null,
        isUnreleased: version.toLowerCase() === 'unreleased',
        entries: [],
      };
      releases.push(current);
      category = null;
      continue;
    }

    if (!current) continue;

    const cat = CATEGORY_HEADING.exec(line);
    if (cat) {
      category = cat[1].trim();
      continue;
    }

    const bullet = BULLET_LINE.exec(line);
    if (bullet) {
      let text = bullet[1].trim();
      let date = current.date;
      const dated = ITEM_DATE_PREFIX.exec(text);
      if (dated) {
        date = dated[1] || dated[2] || current.date;
        text = dated[3].trim();
      }
      current.entries.push({
        id: `${current.version}-${current.entries.length}`,
        version: current.version,
        date,
        category,
        text,
        order: order++,
      });
    }
  }

  return releases.filter(r => r.entries.length > 0);
}

/** Returns releases (and the changes within each release) ordered newest-first or oldest-first. */
export function orderReleases(releases: readonly ChangelogRelease[], order: SortOrder): ChangelogRelease[] {
  if (order === 'newest') {
    return releases.map(r => ({ ...r, entries: [...r.entries] }));
  }
  return [...releases].reverse().map(r => ({
    ...r,
    entries: [...r.entries].reverse(),
  }));
}

/** Filters releases by optional release version and case-insensitive search query. */
export function filterReleases(
  releases: readonly ChangelogRelease[],
  opts: { query?: string; onlyVersion?: string | null } = {},
): ChangelogRelease[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  const only = opts.onlyVersion ?? null;
  const out: ChangelogRelease[] = [];

  for (const release of releases) {
    if (only && release.version !== only) continue;
    if (!q) {
      out.push({ ...release, entries: [...release.entries] });
      continue;
    }
    const headerMatch =
      release.version.toLowerCase().includes(q) ||
      `v${release.version}`.toLowerCase().includes(q) ||
      (release.date ?? '').toLowerCase().includes(q);
    const entries = headerMatch
      ? [...release.entries]
      : release.entries.filter(
          e =>
            e.text.toLowerCase().includes(q) ||
            (e.date ?? '').toLowerCase().includes(q) ||
            (e.category ?? '').toLowerCase().includes(q),
        );
    if (entries.length > 0) out.push({ ...release, entries });
  }

  return out;
}

/** Picks the release matching currentVersion, or the first tagged release, or the top release. */
export function getLatestRelease(
  releases: readonly ChangelogRelease[],
  currentVersion?: string,
): ChangelogRelease | null {
  if (!releases.length) return null;
  if (currentVersion) {
    const exact = releases.find(r => r.version === currentVersion);
    if (exact) return exact;
  }
  return releases.find(r => !r.isUnreleased) ?? releases[0];
}

/** Returns the latest N change entries (newest-first) for compact summaries such as the Dashboard. */
export function getLatestChanges(
  releases: readonly ChangelogRelease[],
  limit = 5,
  currentVersion?: string,
): ChangeEntry[] {
  const latest = getLatestRelease(releases, currentVersion);
  if (!latest) return [];
  return latest.entries.slice(0, Math.max(0, limit));
}

/** Counts the total number of change items across a list of releases. */
export function countChanges(releases: readonly ChangelogRelease[]): number {
  let total = 0;
  for (const r of releases) total += r.entries.length;
  return total;
}

/**
 * Safely tokenizes inline markdown (`code` and **bold**) for React rendering without HTML injection.
 */
export function parseInlineFormatting(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push({ kind: 'code', value: raw.slice(1, -1) });
    } else if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push({ kind: 'strong', value: raw.slice(2, -2) });
    } else {
      tokens.push({ kind: 'text', value: raw });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return tokens.length ? tokens : [{ kind: 'text', value: text }];
}
