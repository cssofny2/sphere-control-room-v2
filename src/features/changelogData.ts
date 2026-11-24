// Bundled changelog entries parsed once from the repository's CHANGELOG.md.
import changelogRaw from '../../CHANGELOG.md?raw';
import { parseChangelog } from './changelog';

export const CHANGELOG_RELEASES = parseChangelog(changelogRaw);
