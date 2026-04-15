/**
 * BugFactsService — fetches real-world facts about identified bug species
 * using the free MediaWiki REST API (no API key required).
 *
 * Falls back to species-specific generated facts when Wikipedia has no article.
 */

import { Bug } from '@/types/Bug';

// ─── Wikipedia summary fetch ──────────────────────────────────────────────

interface WikiSummary {
  extract?: string;
  description?: string;
  title?: string;
}

/**
 * Fetch the Wikipedia extract for a given page title (exact match).
 */
async function fetchWikipediaSummary(query: string): Promise<WikiSummary | null> {
  try {
    const encoded = encodeURIComponent(query.replace(/\s+/g, '_'));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === 'disambiguation' || !data.extract) return null;
    return { extract: data.extract, description: data.description, title: data.title };
  } catch {
    return null;
  }
}

/**
 * Search Wikipedia for the best matching article and return its summary.
 */
async function searchWikipedia(query: string): Promise<WikiSummary | null> {
  try {
    const encoded = encodeURIComponent(query);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=3&format=json&origin=*`;
    const res = await fetch(searchUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.query?.search;
    if (!results || results.length === 0) return null;

    // Try the top search result
    for (const result of results) {
      const summary = await fetchWikipediaSummary(result.title);
      if (summary?.extract && summary.extract.length > 100) return summary;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Split a multi-sentence extract into individual fact strings.
 * Keeps only sentences that look informative (>30 chars, <300 chars).
 */
function extractToFacts(extract: string): string[] {
  return extract
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 300);
}

// ─── Species-specific fallback facts ──────────────────────────────────────

function generateSpecificFacts(bug: Bug): string[] {
  const name = bug.name;
  const species = bug.species;
  const category = bug.category ?? 'insect';
  const facts: string[] = [];

  // Identification fact
  if (species && species !== name) {
    facts.push(`The ${name} is scientifically known as ${species}.`);
  }

  // Habitat fact
  facts.push(`${name} specimens are typically found in ${bug.biome} habitats where they have adapted to local conditions.`);

  // Size fact
  const sizeDescriptions: Record<string, string> = {
    tiny: `The ${name} is a tiny ${category}, often overlooked due to its small size but playing an important role in its ecosystem.`,
    small: `The ${name} is a small ${category} that despite its size is well-adapted to its environment.`,
    medium: `The ${name} is a medium-sized ${category}, a common size range for its family.`,
    large: `The ${name} is a notably large ${category}, making it easier to spot in the wild.`,
    huge: `The ${name} is one of the larger ${category} species, an impressive specimen when encountered in nature.`,
  };
  facts.push(sizeDescriptions[bug.size] || `The ${name} is a ${bug.size}-sized ${category}.`);

  // Traits-based facts
  if (bug.traits.length > 0) {
    const traitList = bug.traits.slice(0, 3).join(', ').toLowerCase();
    facts.push(`The ${name} is known for being ${traitList}, behaviors that help it survive and thrive in the wild.`);
  }

  // Category-specific species fact
  const categorySpecificFact: Record<string, string> = {
    bee: `As a member of the bee family, the ${name} likely plays a role in pollination within its habitat.`,
    butterfly: `As a butterfly species, the ${name} undergoes complete metamorphosis from caterpillar to its adult winged form.`,
    beetle: `The ${name} belongs to the beetle order Coleoptera, the most diverse order of insects on Earth.`,
    ant: `The ${name} is a social insect that likely lives in organized colonies with defined roles for each member.`,
    fly: `The ${name} belongs to the order Diptera, characterized by having a single pair of wings.`,
    spider: `The ${name} is an arachnid, distinguished from insects by having eight legs and no antennae.`,
  };
  if (categorySpecificFact[category]) {
    facts.push(categorySpecificFact[category]);
  }

  // Rarity fact specific to this bug
  const rarityFacts: Record<string, string> = {
    common: `The ${name} is a commonly encountered species, frequently spotted by collectors and naturalists.`,
    uncommon: `The ${name} is an uncommon find — encountered less frequently than many related species.`,
    rare: `The ${name} is a rare species that most collectors would be excited to find.`,
    epic: `The ${name} is an exceptionally uncommon species — a prized find for any entomologist.`,
    legendary: `The ${name} is an extraordinarily rare species — encountering one in the wild is a once-in-a-lifetime event.`,
  };
  if (rarityFacts[bug.rarity]) {
    facts.push(rarityFacts[bug.rarity]);
  }

  return facts;
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface BugFactsResult {
  facts: string[];
  source: 'wikipedia' | 'generated';
}

/**
 * Fetch detailed facts about a bug. Tries Wikipedia (direct + search) first,
 * falls back to species-specific generated facts.
 */
export async function fetchBugFacts(bug: Bug): Promise<BugFactsResult> {
  // Build query list: species name, common name, common name + category
  const queries = [bug.species, bug.name].filter(Boolean);
  const category = bug.category ?? '';
  if (bug.name && category) {
    queries.push(`${bug.name} ${category}`);
  }

  // 1. Try direct page lookup for each query
  for (const q of queries) {
    const summary = await fetchWikipediaSummary(q);
    if (summary?.extract) {
      const wikiFacts = extractToFacts(summary.extract);
      if (wikiFacts.length >= 2) {
        return { facts: wikiFacts.slice(0, 6), source: 'wikipedia' };
      }
    }
  }

  // 2. Try Wikipedia search API as fallback
  for (const q of queries) {
    const summary = await searchWikipedia(q);
    if (summary?.extract) {
      const wikiFacts = extractToFacts(summary.extract);
      if (wikiFacts.length >= 2) {
        return { facts: wikiFacts.slice(0, 6), source: 'wikipedia' };
      }
    }
  }

  // 3. Fallback: species-specific generated facts
  return { facts: generateSpecificFacts(bug), source: 'generated' };
}
