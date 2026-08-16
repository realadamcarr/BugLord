// Shared types for GBIF data used across the scanner UI.
// Keeps gbifService.ts as the network layer and lets components import
// lightweight types without pulling in the whole service.

export interface GbifSpeciesSuggestion {
  speciesKey: number;
  scientificName: string;
  canonicalName: string | null;
  family: string | null;
  order: string | null;
}
