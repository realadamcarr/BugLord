// Maps app bug categories to optimal iNaturalist search queries.
// Some categories (like "fly") need disambiguation to avoid non-insect results.

import { BugCategory } from '../../constants/bugSprites';

const BUG_TYPE_QUERY_MAP: Record<BugCategory, string> = {
  bee: 'bee',
  butterfly: 'butterfly',
  beetle: 'beetle',
  fly: 'fly insect',
  spider: 'spider',
  ant: 'ant',
};

/** Returns an iNaturalist-friendly search string for a given bug category. */
export function getINatQuery(bugType: string): string {
  const key = bugType.toLowerCase().trim() as BugCategory;
  return BUG_TYPE_QUERY_MAP[key] ?? bugType;
}
