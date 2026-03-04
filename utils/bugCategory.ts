// Maps ML labels (and common bug names) to a BugCategory for sprite selection.
import { BugCategory } from '../constants/bugSprites';

/**
 * Keyword → BugCategory lookup.
 * Order matters: more-specific keywords are checked first.
 */
const KEYWORD_MAP: [RegExp, BugCategory][] = [
  // Bees / wasps / hornets → bee sprite
  [/\b(bee|bumble\s*bee|honey\s*bee|wasp|hornet|yellow\s*jacket)\b/i, 'bee'],

  // Butterflies / moths / caterpillars → butterfly sprite
  [/\b(butterfly|butterfl|moth|caterpillar|monarch|swallowtail|skipper|silkworm)\b/i, 'butterfly'],

  // Beetles / ladybugs / weevils → beetle sprite
  [/\b(beetle|ladybug|lady\s*bug|ladybird|weevil|stag|scarab|firefly|lightning\s*bug|june\s*bug)\b/i, 'beetle'],

  // Flies / mosquitoes / gnats / dragonflies → fly sprite
  [/\b(fly|flies|mosquito|gnat|midge|crane\s*fly|dragonfly|damselfly|hover\s*fly)\b/i, 'fly'],

  // Spiders / ticks / scorpions → spider sprite
  [/\b(spider|tarantula|tick|scorpion|harvestman|daddy\s*long\s*legs|arachnid|widow|orb[- ]?weaver|jumping\s*spider|wolf\s*spider)\b/i, 'spider'],

  // Ants / termites → ant sprite
  [/\b(ant|ants|fire\s*ant|carpenter\s*ant|termite|formicidae)\b/i, 'ant'],
];

/**
 * Given an ML label string (e.g. "Bees", "Butterfly", "Ladybug", "ant"),
 * return the best-matching BugCategory, or undefined if nothing matches.
 */
export function labelToCategory(label: string): BugCategory | undefined {
  if (!label) return undefined;
  for (const [regex, category] of KEYWORD_MAP) {
    if (regex.test(label)) return category;
  }
  return undefined;
}
