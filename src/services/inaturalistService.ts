// Public read-only iNaturalist API service.
// Uses only unauthenticated GET endpoints — no OAuth, no API keys.

import { getINatQuery } from '../utils/bugTypeToINatQuery';

const BASE_URL = 'https://api.inaturalist.org/v1';
const DEFAULT_PER_PAGE = 10;
const SUGGESTION_LIMIT = 5;

// ─── Raw API response types ─────────────────────────────

interface INatTaxonPhoto {
  medium_url?: string;
  square_url?: string;
}

interface INatTaxonDefaultPhoto {
  medium_url?: string;
  square_url?: string;
}

interface INatTaxon {
  id: number;
  name: string;
  preferred_common_name?: string;
  iconic_taxon_name?: string;
  default_photo?: INatTaxonDefaultPhoto;
}

interface INatTaxaResponse {
  results: INatTaxon[];
  total_results: number;
}

interface INatObservationTaxon {
  name?: string;
  preferred_common_name?: string;
}

interface INatObservationPhoto {
  url?: string;
}

interface INatObservation {
  id: number;
  taxon?: INatObservationTaxon;
  photos?: INatObservationPhoto[];
  observed_on_string?: string;
  place_guess?: string;
}

interface INatObservationsResponse {
  results: INatObservation[];
  total_results: number;
}

// ─── App-facing mapped types ─────────────────────────────

export interface INatTaxonResult {
  id: number;
  name: string;
  commonName: string | null;
  imageUrl: string | null;
  iconicTaxonName: string | null;
}

export interface INatObservationResult {
  id: number;
  speciesName: string;
  commonName: string | null;
  imageUrl: string | null;
  observedOn: string | null;
  location: string | null;
}

/** Unified suggestion returned by getSpeciesSuggestionsForBugType */
export interface INatSpeciesSuggestion {
  id: number;
  name: string;
  commonName: string | null;
  imageUrl: string | null;
}

// ─── Service functions ───────────────────────────────────

/**
 * Search iNaturalist taxa by free-text query.
 * Only returns species-rank results.
 */
export async function searchTaxa(
  query: string,
  perPage: number = DEFAULT_PER_PAGE,
): Promise<INatTaxonResult[]> {
  const url = `${BASE_URL}/taxa?q=${encodeURIComponent(query)}&rank=species&per_page=${perPage}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (__DEV__) console.warn(`[iNat] taxa request failed: ${res.status}`);
      return [];
    }

    const data: INatTaxaResponse = await res.json();

    return (data.results ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      commonName: t.preferred_common_name ?? null,
      imageUrl: t.default_photo?.medium_url ?? t.default_photo?.square_url ?? null,
      iconicTaxonName: t.iconic_taxon_name ?? null,
    }));
  } catch (err) {
    if (__DEV__) console.warn('[iNat] taxa network error:', err);
    return [];
  }
}

/**
 * Search iNaturalist observations by free-text query.
 */
export async function searchObservations(
  query: string,
  perPage: number = DEFAULT_PER_PAGE,
): Promise<INatObservationResult[]> {
  const url = `${BASE_URL}/observations?q=${encodeURIComponent(query)}&per_page=${perPage}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (__DEV__) console.warn(`[iNat] observations request failed: ${res.status}`);
      return [];
    }

    const data: INatObservationsResponse = await res.json();

    return (data.results ?? []).map((o) => ({
      id: o.id,
      speciesName: o.taxon?.name ?? 'Unknown',
      commonName: o.taxon?.preferred_common_name ?? null,
      imageUrl: o.photos?.[0]?.url?.replace('square', 'medium') ?? null,
      observedOn: o.observed_on_string ?? null,
      location: o.place_guess ?? null,
    }));
  } catch (err) {
    if (__DEV__) console.warn('[iNat] observations network error:', err);
    return [];
  }
}

/**
 * Given a broad bug type predicted by the app (e.g. "bee", "spider"),
 * return up to 5 real-world species suggestions from iNaturalist.
 *
 * Tries taxa first; falls back to observations if taxa returns nothing.
 */
export async function getSpeciesSuggestionsForBugType(
  bugType: string,
): Promise<INatSpeciesSuggestion[]> {
  const query = getINatQuery(bugType);

  // 1. Try taxa search
  const taxa = await searchTaxa(query, SUGGESTION_LIMIT);
  if (taxa.length > 0) {
    return taxa.slice(0, SUGGESTION_LIMIT).map((t) => ({
      id: t.id,
      name: t.name,
      commonName: t.commonName,
      imageUrl: t.imageUrl,
    }));
  }

  // 2. Fallback to observations
  if (__DEV__) console.log(`[iNat] No taxa for "${query}", falling back to observations`);
  const obs = await searchObservations(query, SUGGESTION_LIMIT);
  if (obs.length > 0) {
    // Deduplicate by species name
    const seen = new Set<string>();
    const unique: INatSpeciesSuggestion[] = [];
    for (const o of obs) {
      if (seen.has(o.speciesName)) continue;
      seen.add(o.speciesName);
      unique.push({
        id: o.id,
        name: o.speciesName,
        commonName: o.commonName,
        imageUrl: o.imageUrl,
      });
      if (unique.length >= SUGGESTION_LIMIT) break;
    }
    return unique;
  }

  return [];
}
