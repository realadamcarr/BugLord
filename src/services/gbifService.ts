// Public read-only GBIF API service.
// Uses only unauthenticated GET endpoints — no OAuth, no API keys.

import { getGbifQuery } from '../utils/bugTypeToGbifQuery';

const BASE_URL = 'https://api.gbif.org/v1';
const DEFAULT_LIMIT = 10;
const SUGGESTION_LIMIT = 5;

/** Standard headers for every GBIF request (GBIF asks for a User-Agent). */
const GBIF_HEADERS: HeadersInit = {
  'User-Agent': 'BugLord/1.0 (student project)',
};

// ─── Raw GBIF API response types ────────────────────────

interface GbifSpeciesSearchResult {
  key: number;
  scientificName?: string;
  canonicalName?: string;
  rank?: string;
  taxonomicStatus?: string;
  kingdom?: string;
  phylum?: string;
  order?: string;
  family?: string;
  genus?: string;
}

interface GbifSpeciesSearchResponse {
  offset: number;
  limit: number;
  results: GbifSpeciesSearchResult[];
}

interface GbifSpeciesDetail {
  key: number;
  scientificName?: string;
  canonicalName?: string;
  rank?: string;
  taxonomicStatus?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  vernacularName?: string;
}

interface GbifOccurrenceResult {
  key: number;
  scientificName?: string;
  country?: string;
  locality?: string;
  eventDate?: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
}

interface GbifOccurrenceSearchResponse {
  offset: number;
  limit: number;
  results: GbifOccurrenceResult[];
}

// ─── App-facing mapped types ─────────────────────────────

export interface GbifSpeciesResult {
  speciesKey: number;
  scientificName: string;
  canonicalName: string | null;
  rank: string | null;
  status: string | null;
  kingdom: string | null;
  phylum: string | null;
  order: string | null;
  family: string | null;
  genus: string | null;
}

export interface GbifSpeciesDetailResult {
  speciesKey: number;
  scientificName: string;
  canonicalName: string | null;
  rank: string | null;
  status: string | null;
  kingdom: string | null;
  phylum: string | null;
  className: string | null;
  order: string | null;
  family: string | null;
  genus: string | null;
  vernacularName: string | null;
}

export interface GbifOccurrence {
  key: number;
  scientificName: string | null;
  country: string | null;
  locality: string | null;
  eventDate: string | null;
  decimalLatitude: number | null;
  decimalLongitude: number | null;
}

/** Unified suggestion returned by getSpeciesSuggestionsForBugType */
export interface GbifSpeciesSuggestion {
  speciesKey: number;
  scientificName: string;
  canonicalName: string | null;
  family: string | null;
  order: string | null;
}

// ─── Service functions ───────────────────────────────────

/**
 * Search GBIF species by free-text query.
 * Filtered to species rank only.
 */
export async function searchSpecies(
  query: string,
  limit: number = DEFAULT_LIMIT,
): Promise<GbifSpeciesResult[]> {
  const url = `${BASE_URL}/species/search?q=${encodeURIComponent(query)}&rank=SPECIES&limit=${limit}`;

  try {
    const res = await fetch(url, { headers: GBIF_HEADERS });
    if (!res.ok) {
      if (__DEV__) console.warn(`[GBIF] species search failed: ${res.status}`);
      return [];
    }

    const data: GbifSpeciesSearchResponse = await res.json();

    return (data.results ?? []).map((r) => ({
      speciesKey: r.key,
      scientificName: r.scientificName ?? 'Unknown',
      canonicalName: r.canonicalName ?? null,
      rank: r.rank ?? null,
      status: r.taxonomicStatus ?? null,
      kingdom: r.kingdom ?? null,
      phylum: r.phylum ?? null,
      order: r.order ?? null,
      family: r.family ?? null,
      genus: r.genus ?? null,
    }));
  } catch (err) {
    if (__DEV__) console.warn('[GBIF] species search error:', err);
    return [];
  }
}

/**
 * Get detailed taxonomy for a single species by key.
 */
export async function getSpeciesDetails(
  speciesKey: number,
): Promise<GbifSpeciesDetailResult | null> {
  const url = `${BASE_URL}/species/${speciesKey}`;

  try {
    const res = await fetch(url, { headers: GBIF_HEADERS });
    if (!res.ok) {
      if (__DEV__) console.warn(`[GBIF] species detail failed: ${res.status}`);
      return null;
    }

    const r: GbifSpeciesDetail = await res.json();

    return {
      speciesKey: r.key,
      scientificName: r.scientificName ?? 'Unknown',
      canonicalName: r.canonicalName ?? null,
      rank: r.rank ?? null,
      status: r.taxonomicStatus ?? null,
      kingdom: r.kingdom ?? null,
      phylum: r.phylum ?? null,
      className: r.class ?? null,
      order: r.order ?? null,
      family: r.family ?? null,
      genus: r.genus ?? null,
      vernacularName: r.vernacularName ?? null,
    };
  } catch (err) {
    if (__DEV__) console.warn('[GBIF] species detail error:', err);
    return null;
  }
}

/**
 * Search occurrence records for a given taxon key.
 */
export async function searchOccurrencesByTaxon(
  speciesKey: number,
  limit: number = DEFAULT_LIMIT,
): Promise<GbifOccurrence[]> {
  const url = `${BASE_URL}/occurrence/search?taxon_key=${speciesKey}&limit=${limit}`;

  try {
    const res = await fetch(url, { headers: GBIF_HEADERS });
    if (!res.ok) {
      if (__DEV__) console.warn(`[GBIF] occurrence search failed: ${res.status}`);
      return [];
    }

    const data: GbifOccurrenceSearchResponse = await res.json();

    return (data.results ?? []).map((o) => ({
      key: o.key,
      scientificName: o.scientificName ?? null,
      country: o.country ?? null,
      locality: o.locality ?? null,
      eventDate: o.eventDate ?? null,
      decimalLatitude: o.decimalLatitude ?? null,
      decimalLongitude: o.decimalLongitude ?? null,
    }));
  } catch (err) {
    if (__DEV__) console.warn('[GBIF] occurrence search error:', err);
    return [];
  }
}

/**
 * Given a broad bug type predicted by the app (e.g. "bee", "spider"),
 * return up to 5 species suggestions from GBIF with taxonomy info.
 */
export async function getSpeciesSuggestionsForBugType(
  bugType: string,
): Promise<GbifSpeciesSuggestion[]> {
  const query = getGbifQuery(bugType);

  try {
    const results = await searchSpecies(query, SUGGESTION_LIMIT * 2);

    // Filter to Animalia only — GBIF returns plants/fungi too
    const animals = results.filter(
      (r) => !r.kingdom || r.kingdom.toLowerCase() === 'animalia',
    );

    return animals.slice(0, SUGGESTION_LIMIT).map((r) => ({
      speciesKey: r.speciesKey,
      scientificName: r.scientificName,
      canonicalName: r.canonicalName,
      family: r.family,
      order: r.order,
    }));
  } catch (err) {
    if (__DEV__) console.warn('[GBIF] suggestions error:', err);
    return [];
  }
}
