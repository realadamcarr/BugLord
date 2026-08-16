// Maps app bug categories to GBIF-friendly search queries.

import { BugCategory } from '../../constants/bugSprites';

const BUG_TYPE_QUERY_MAP: Record<BugCategory, string> = {
  bee: 'bee',
  butterfly: 'butterfly',
  beetle: 'beetle',
  fly: 'fly insect',
  spider: 'spider',
  ant: 'ant',
};

/** Returns a GBIF-friendly search string for a given bug category. */
export function getGbifQuery(bugType: string): string {
  const key = bugType.toLowerCase().trim() as BugCategory;
  return BUG_TYPE_QUERY_MAP[key] ?? bugType;
}
