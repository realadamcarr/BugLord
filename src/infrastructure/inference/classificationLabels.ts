import type { BugCategory } from '../../../constants/bugSprites';

export const CLASSIFICATION_DISPLAY_LABELS: Record<string, string> = {
  Butterfly: 'Monarch Butterfly',
  Dragonfly: 'Blue Dasher Dragonfly',
  Grasshopper: 'Grasshopper',
  Ladybug: 'Ladybug',
  Mosquito: 'Mosquito',
  Moth: 'Luna Moth',
  Bees: 'Honey Bee',
  ant: 'Black Garden Ant',
  beetle: 'Stag Beetle',
  caterpillar: 'Caterpillar',
  earthworms: 'Earthworm',
  wasp: 'Paper Wasp',
};

const PRIMARY_CATEGORIES = new Set<BugCategory>([
  'bee', 'butterfly', 'beetle', 'fly', 'spider', 'ant',
]);

export function displayLabelFor(label: string): string {
  return CLASSIFICATION_DISPLAY_LABELS[label] ?? label;
}

export function categoryFor(label: string): BugCategory | null {
  const normalized = label.toLowerCase() as BugCategory;
  return PRIMARY_CATEGORIES.has(normalized) ? normalized : null;
}
