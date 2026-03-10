// Bug Collector - Core Types and Interfaces
import { BugCategory } from '../constants/bugSprites';

export type BugRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type BiomeType = 'forest' | 'garden' | 'wetland' | 'desert' | 'urban' | 'mountain' | 'meadow';

export interface Bug {
  id: string;
  name: string;
  nickname?: string;
  species: string;
  description: string;
  rarity: BugRarity;
  biome: BiomeType;
  
  // Visual
  photo?: string; // Base64 or file path (original image uri)
  pixelArt?: string; // Pixelized version for collection view
  category?: BugCategory; // Sprite category (bee/butterfly/beetle/fly/spider/ant)
  
  // Stats and traits
  xpValue: number;
  traits: string[];
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  
  // Metadata
  caughtAt: Date;
  location?: string;
  weather?: string;
  
  // ML/Identification metadata
  predictedCandidates?: IdentificationCandidate[];
  userConfirmedLabel?: string;
  confirmedLabel?: string; // Alias for userConfirmedLabel
  confirmationMethod?: ConfirmationMethod;
  provider?: string;
  confidence?: number;
  modelVersionUsed?: string; // ML model version used for prediction
  imageUri?: string; // Original captured image URI
  capturedAt?: string; // ISO string timestamp of capture
  
  // Game stats
  level: number;
  xp: number;
  maxXp: number;
  
  // Battle stats
  currentHp?: number; // Current HP (defaults to maxHp if not set)
  maxHp?: number; // Maximum HP (calculated from level/stats)
  attack?: number; // Attack power
  defense?: number; // Defense rating
  speed?: number; // Speed rating
}

export interface BugCollection {
  bugs: Bug[];
  party: (Bug | null)[]; // Active party (alias for parties[activePartyIndex])
  parties: (Bug | null)[][]; // Array of 3 parties, each with 6 slots
  activePartyIndex: number; // 0, 1, or 2
  totalXp: number;
  level: number;
  xp: number;
  profilePicture: string; // Key into PROFILE_PICTURES, default 'default'
}

export type ConfirmationMethod = 'AI_PICK' | 'MANUAL' | 'UNKNOWN';

export interface IdentificationCandidate {
  label: string;
  confidence?: number;
  source: string; // e.g. 'iNaturalist', 'GoogleVision', 'Local'
  species?: string;
  category?: import('../constants/bugSprites').BugCategory;
}

export interface BugIdentificationResult {
  candidates: IdentificationCandidate[];
  provider: string;
  isFromAPI: boolean;
}

// Rarity configuration
export const RARITY_CONFIG = {
  common: {
    color: '#4a7c59',
    xpRange: [10, 25],
    probability: 0.6,
  },
  uncommon: {
    color: '#5c715e',
    xpRange: [20, 40],
    probability: 0.25,
  },
  rare: {
    color: '#b8860b',
    xpRange: [35, 60],
    probability: 0.1,
  },
  epic: {
    color: '#704214',
    xpRange: [50, 80],
    probability: 0.04,
  },
  legendary: {
    color: '#8b4513',
    xpRange: [75, 120],
    probability: 0.01,
  },
};

// Biome configuration
export const BIOME_CONFIG = {
  forest: { emoji: '🌲', color: '#228B22' },
  garden: { emoji: '🌻', color: '#32CD32' },
  wetland: { emoji: '🐸', color: '#4682B4' },
  desert: { emoji: '🌵', color: '#DEB887' },
  urban: { emoji: '🏙️', color: '#696969' },
  mountain: { emoji: '⛰️', color: '#708090' },
  meadow: { emoji: '🌾', color: '#9ACD32' },
};

// Base battle-stat ranges per rarity (min, max). Higher rarity → stronger.
const BATTLE_STAT_RANGES: Record<BugRarity, { attack: [number, number]; defense: [number, number]; speed: [number, number] }> = {
  common:    { attack: [5, 10],  defense: [4, 9],   speed: [4, 9]  },
  uncommon:  { attack: [8, 14],  defense: [7, 13],  speed: [7, 13] },
  rare:      { attack: [12, 20], defense: [10, 18], speed: [10, 18] },
  epic:      { attack: [18, 28], defense: [15, 25], speed: [15, 25] },
  legendary: { attack: [25, 40], defense: [22, 35], speed: [22, 35] },
};

const randBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper function to generate random bug stats
export const generateBugStats = (rarity: BugRarity): {
  xp: number; maxXp: number; level: number;
  attack: number; defense: number; speed: number;
} => {
  const config = RARITY_CONFIG[rarity];
  const baseXp = Math.floor(Math.random() * (config.xpRange[1] - config.xpRange[0]) + config.xpRange[0]);
  const bs = BATTLE_STAT_RANGES[rarity];
  return {
    xp: 0,
    maxXp: baseXp,
    level: 1,
    attack: randBetween(bs.attack[0], bs.attack[1]),
    defense: randBetween(bs.defense[0], bs.defense[1]),
    speed: randBetween(bs.speed[0], bs.speed[1]),
  };
};

// Sample bug database (for AI fallback / image-based classification)
// Each entry includes a `colorProfile` that the local image classifier uses
// to match against actual photo features (hue, brightness, saturation).
export interface SampleBugColorProfile {
  /** Dominant hue range in degrees (0-360): red=0, yellow=60, green=120, cyan=180, blue=240, magenta=300 */
  hueRange: [number, number];
  /** Expected brightness 0-1 (0=very dark, 1=very bright) */
  brightnessRange: [number, number];
  /** Expected saturation 0-1 */
  saturationRange: [number, number];
}

export const SAMPLE_BUGS: {
  name: string;
  species: string;
  rarity: BugRarity;
  biome: BiomeType;
  description: string;
  traits: string[];
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  colorProfile: SampleBugColorProfile;
}[] = [
  // ─── Dark / Black insects ──────────────────────────────
  {
    name: 'Black Garden Ant',
    species: 'Lasius niger',
    rarity: 'common',
    biome: 'garden',
    description: 'One of the most widespread ant species, found in gardens worldwide.',
    traits: ['Colony Builder', 'Forager', 'Common'],
    size: 'tiny',
    colorProfile: { hueRange: [0, 360], brightnessRange: [0.0, 0.20], saturationRange: [0.0, 0.15] },
  },
  {
    name: 'Ground Beetle',
    species: 'Carabidae family',
    rarity: 'common',
    biome: 'garden',
    description: 'A common ground beetle found in gardens and parks.',
    traits: ['Ground dweller', 'Nocturnal', 'Beneficial'],
    size: 'small',
    colorProfile: { hueRange: [0, 360], brightnessRange: [0.05, 0.25], saturationRange: [0.0, 0.20] },
  },
  {
    name: 'Black Cricket',
    species: 'Gryllus assimilis',
    rarity: 'common',
    biome: 'garden',
    description: 'Nocturnal insect known for its distinctive chirping.',
    traits: ['Nocturnal', 'Musical', 'Jumper'],
    size: 'small',
    colorProfile: { hueRange: [20, 50], brightnessRange: [0.08, 0.28], saturationRange: [0.05, 0.25] },
  },
  {
    name: 'Stag Beetle',
    species: 'Lucanus cervus',
    rarity: 'rare',
    biome: 'forest',
    description: 'Impressive beetle with large mandibles resembling antlers.',
    traits: ['Strong', 'Territorial', 'Long-lived'],
    size: 'large',
    colorProfile: { hueRange: [0, 45], brightnessRange: [0.10, 0.58], saturationRange: [0.06, 0.38] },
  },
  // ─── Red / Warm insects ────────────────────────────────
  {
    name: 'Ladybug',
    species: 'Coccinella septempunctata',
    rarity: 'common',
    biome: 'garden',
    description: 'Beloved red-and-black spotted beetle, great for pest control.',
    traits: ['Beneficial', 'Spotted', 'Tiny'],
    size: 'tiny',
    colorProfile: { hueRange: [0, 15], brightnessRange: [0.30, 0.60], saturationRange: [0.50, 1.0] },
  },
  {
    name: 'Fire Ant',
    species: 'Solenopsis invicta',
    rarity: 'uncommon',
    biome: 'garden',
    description: 'Aggressive ant species with a painful venomous sting.',
    traits: ['Aggressive', 'Colony Builder', 'Venomous'],
    size: 'tiny',
    colorProfile: { hueRange: [0, 30], brightnessRange: [0.14, 0.55], saturationRange: [0.18, 0.80] },
  },
  {
    name: 'Red Velvet Ant',
    species: 'Dasymutilla occidentalis',
    rarity: 'rare',
    biome: 'desert',
    description: 'Actually a wingless wasp with vivid red-orange fur and a potent sting.',
    traits: ['Venomous', 'Solitary', 'Fuzzy'],
    size: 'small',
    colorProfile: { hueRange: [0, 20], brightnessRange: [0.25, 0.50], saturationRange: [0.55, 1.0] },
  },
  // ─── Yellow / Orange insects ───────────────────────────
  {
    name: 'Honey Bee',
    species: 'Apis mellifera',
    rarity: 'common',
    biome: 'meadow',
    description: 'Essential pollinator that produces honey and beeswax.',
    traits: ['Pollinator', 'Social', 'Honey Producer'],
    size: 'small',
    colorProfile: { hueRange: [30, 55], brightnessRange: [0.35, 0.65], saturationRange: [0.40, 0.85] },
  },
  {
    name: 'Bumble Bee',
    species: 'Bombus terrestris',
    rarity: 'common',
    biome: 'meadow',
    description: 'Fuzzy black-and-yellow bee that is a powerful pollinator in gardens and fields.',
    traits: ['Pollinator', 'Fuzzy', 'Striped'],
    size: 'small',
    colorProfile: { hueRange: [28, 62], brightnessRange: [0.22, 0.58], saturationRange: [0.30, 0.75] },
  },
  {
    name: 'Paper Wasp',
    species: 'Polistes dominula',
    rarity: 'uncommon',
    biome: 'urban',
    description: 'Slender wasp that builds distinctive paper nests under eaves.',
    traits: ['Nest Builder', 'Predator', 'Territorial'],
    size: 'medium',
    colorProfile: { hueRange: [40, 60], brightnessRange: [0.40, 0.70], saturationRange: [0.50, 0.90] },
  },
  {
    name: 'Monarch Butterfly',
    species: 'Danaus plexippus',
    rarity: 'uncommon',
    biome: 'meadow',
    description: 'Famous migrating butterfly with iconic orange-and-black wings.',
    traits: ['Migratory', 'Toxic', 'Pollinator'],
    size: 'medium',
    colorProfile: { hueRange: [20, 45], brightnessRange: [0.40, 0.70], saturationRange: [0.55, 1.0] },
  },
  {
    name: 'Golden Scarab',
    species: 'Chrysina resplendens',
    rarity: 'epic',
    biome: 'forest',
    description: 'Stunning metallic gold beetle, prized by collectors worldwide.',
    traits: ['Metallic', 'Rare', 'Beautiful'],
    size: 'medium',
    colorProfile: { hueRange: [45, 65], brightnessRange: [0.55, 0.85], saturationRange: [0.60, 1.0] },
  },
  // ─── Green insects ─────────────────────────────────────
  {
    name: 'Grasshopper',
    species: 'Caelifera suborder',
    rarity: 'common',
    biome: 'meadow',
    description: 'Powerful jumping insect commonly found in grassy fields.',
    traits: ['Jumper', 'Herbivore', 'Camouflaged'],
    size: 'medium',
    colorProfile: { hueRange: [80, 150], brightnessRange: [0.30, 0.60], saturationRange: [0.30, 0.75] },
  },
  {
    name: 'Praying Mantis',
    species: 'Mantis religiosa',
    rarity: 'rare',
    biome: 'garden',
    description: 'Fascinating ambush predator with distinctive prayer-like pose.',
    traits: ['Predator', 'Camouflaged', 'Patient'],
    size: 'large',
    colorProfile: { hueRange: [90, 160], brightnessRange: [0.25, 0.55], saturationRange: [0.25, 0.65] },
  },
  {
    name: 'Katydid',
    species: 'Tettigoniidae family',
    rarity: 'uncommon',
    biome: 'forest',
    description: 'Leaf-like insect with long antennae, sings at night.',
    traits: ['Camouflaged', 'Nocturnal', 'Musical'],
    size: 'medium',
    colorProfile: { hueRange: [100, 155], brightnessRange: [0.35, 0.65], saturationRange: [0.35, 0.80] },
  },
  {
    name: 'Jewel Beetle',
    species: 'Chrysochroa fulgidissima',
    rarity: 'epic',
    biome: 'forest',
    description: 'Iridescent green beetle prized for its dazzling metallic sheen.',
    traits: ['Metallic', 'Iridescent', 'Beautiful'],
    size: 'small',
    colorProfile: { hueRange: [120, 180], brightnessRange: [0.40, 0.70], saturationRange: [0.50, 0.90] },
  },
  // ─── Blue / Cyan insects ───────────────────────────────
  {
    name: 'Blue Morpho Butterfly',
    species: 'Morpho menelaus',
    rarity: 'rare',
    biome: 'forest',
    description: 'Spectacular iridescent blue butterfly found in tropical forests.',
    traits: ['Iridescent', 'Day active', 'Fast flyer'],
    size: 'large',
    colorProfile: { hueRange: [200, 250], brightnessRange: [0.30, 0.60], saturationRange: [0.45, 0.90] },
  },
  {
    name: 'Blue Dasher Dragonfly',
    species: 'Pachydiplax longipennis',
    rarity: 'uncommon',
    biome: 'wetland',
    description: 'Agile dragonfly with striking blue body, patrols near water.',
    traits: ['Fast flyer', 'Predator', 'Aquatic youth'],
    size: 'medium',
    colorProfile: { hueRange: [195, 240], brightnessRange: [0.35, 0.65], saturationRange: [0.35, 0.80] },
  },
  {
    name: 'Azure Damselfly',
    species: 'Coenagrion puella',
    rarity: 'uncommon',
    biome: 'wetland',
    description: 'Delicate blue damselfly often seen near ponds and streams.',
    traits: ['Delicate', 'Day active', 'Aquatic youth'],
    size: 'small',
    colorProfile: { hueRange: [210, 260], brightnessRange: [0.40, 0.70], saturationRange: [0.40, 0.85] },
  },
  // ─── Brown / Earthy insects ────────────────────────────
  {
    name: 'Cockroach',
    species: 'Periplaneta americana',
    rarity: 'common',
    biome: 'urban',
    description: 'Resilient insect that has survived since the age of dinosaurs.',
    traits: ['Resilient', 'Nocturnal', 'Fast'],
    size: 'medium',
    colorProfile: { hueRange: [15, 40], brightnessRange: [0.18, 0.40], saturationRange: [0.20, 0.50] },
  },
  {
    name: 'House Fly',
    species: 'Musca domestica',
    rarity: 'common',
    biome: 'urban',
    description: 'Common gray fly with red eyes, frequently found around human habitats.',
    traits: ['Fast', 'Common', 'Scavenger'],
    size: 'small',
    colorProfile: { hueRange: [0, 360], brightnessRange: [0.28, 0.62], saturationRange: [0.04, 0.30] },
  },
  // ─── Spiders / Arachnids ──────────────────────────────
  {
    name: 'Wolf Spider',
    species: 'Lycosidae family',
    rarity: 'common',
    biome: 'garden',
    description: 'Robust ground-hunting spider with excellent eyesight, often brown and hairy.',
    traits: ['Fast', 'Ground Hunter', 'Nocturnal'],
    size: 'medium',
    colorProfile: { hueRange: [15, 45], brightnessRange: [0.20, 0.50], saturationRange: [0.10, 0.40] },
  },
  {
    name: 'Garden Spider',
    species: 'Araneus diadematus',
    rarity: 'common',
    biome: 'garden',
    description: 'Classic orb-weaver spider recognized by the cross pattern on its abdomen.',
    traits: ['Web Builder', 'Patient', 'Beneficial'],
    size: 'medium',
    colorProfile: { hueRange: [20, 50], brightnessRange: [0.25, 0.55], saturationRange: [0.15, 0.45] },
  },
  {
    name: 'Jumping Spider',
    species: 'Salticidae family',
    rarity: 'uncommon',
    biome: 'garden',
    description: 'Tiny agile spider with large forward-facing eyes and impressive leaping ability.',
    traits: ['Jumper', 'Curious', 'Sharp-eyed'],
    size: 'tiny',
    colorProfile: { hueRange: [0, 360], brightnessRange: [0.10, 0.35], saturationRange: [0.05, 0.30] },
  },
  {
    name: 'Black Widow',
    species: 'Latrodectus mactans',
    rarity: 'rare',
    biome: 'urban',
    description: 'Infamous venomous spider with a glossy black body and red hourglass marking.',
    traits: ['Venomous', 'Nocturnal', 'Web Builder'],
    size: 'small',
    colorProfile: { hueRange: [0, 360], brightnessRange: [0.02, 0.18], saturationRange: [0.0, 0.20] },
  },
  {
    name: 'Tarantula',
    species: 'Theraphosidae family',
    rarity: 'rare',
    biome: 'desert',
    description: 'Large hairy spider with a docile temperament despite its fearsome appearance.',
    traits: ['Hairy', 'Burrower', 'Long-lived'],
    size: 'large',
    colorProfile: { hueRange: [15, 40], brightnessRange: [0.15, 0.40], saturationRange: [0.10, 0.35] },
  },
  {
    name: 'Scorpion',
    species: 'Scorpiones order',
    rarity: 'rare',
    biome: 'desert',
    description: 'Ancient predatory arachnid armed with venomous sting, glows under UV light.',
    traits: ['Venomous', 'Nocturnal', 'Ancient', 'UV Glow'],
    size: 'medium',
    colorProfile: { hueRange: [20, 55], brightnessRange: [0.28, 0.62], saturationRange: [0.28, 0.70] },
  },
  {
    name: 'Golden Silk Orb-Weaver',
    species: 'Trichonephila clavipes',
    rarity: 'epic',
    biome: 'forest',
    description: 'Large spider famous for spinning webs of shimmering golden silk.',
    traits: ['Web Builder', 'Golden Silk', 'Large'],
    size: 'large',
    colorProfile: { hueRange: [30, 60], brightnessRange: [0.30, 0.60], saturationRange: [0.25, 0.60] },
  },
  {
    name: 'Luna Moth',
    species: 'Actias luna',
    rarity: 'rare',
    biome: 'forest',
    description: 'Ethereal pale-green moth with long trailing tails, active at night.',
    traits: ['Nocturnal', 'Delicate', 'Short-lived'],
    size: 'large',
    colorProfile: { hueRange: [100, 160], brightnessRange: [0.55, 0.85], saturationRange: [0.20, 0.55] },
  },
  {
    name: 'Hawk Moth',
    species: 'Manduca sexta',
    rarity: 'uncommon',
    biome: 'garden',
    description: 'Fast-flying moth that hovers like a hummingbird to feed on nectar.',
    traits: ['Fast flyer', 'Nocturnal', 'Hoverer'],
    size: 'medium',
    colorProfile: { hueRange: [20, 50], brightnessRange: [0.30, 0.55], saturationRange: [0.10, 0.40] },
  },
  // ─── White / Bright / Pale insects ─────────────────────
  {
    name: 'Cabbage White Butterfly',
    species: 'Pieris rapae',
    rarity: 'common',
    biome: 'garden',
    description: 'Ubiquitous white butterfly found in gardens around the world.',
    traits: ['Common', 'Pollinator', 'Day active'],
    size: 'small',
    colorProfile: { hueRange: [0, 360], brightnessRange: [0.70, 1.0], saturationRange: [0.0, 0.25] },
  },
  {
    name: 'Cicada',
    species: 'Magicicada septendecim',
    rarity: 'uncommon',
    biome: 'forest',
    description: 'Periodical insect famous for its loud summer buzzing songs.',
    traits: ['Musical', 'Long lifecycle', 'Periodic'],
    size: 'medium',
    colorProfile: { hueRange: [15, 55], brightnessRange: [0.25, 0.50], saturationRange: [0.15, 0.40] },
  },
  // ─── Purple / Magenta insects ──────────────────────────
  {
    name: 'Violet Ground Beetle',
    species: 'Carabus violaceus',
    rarity: 'rare',
    biome: 'forest',
    description: 'Beautiful dark beetle with violet-purple metallic edges.',
    traits: ['Predator', 'Nocturnal', 'Iridescent'],
    size: 'medium',
    colorProfile: { hueRange: [260, 310], brightnessRange: [0.15, 0.40], saturationRange: [0.25, 0.65] },
  },
  {
    name: 'Emperor Dragonfly',
    species: 'Anax imperator',
    rarity: 'epic',
    biome: 'wetland',
    description: 'One of the largest dragonflies, a powerful aerial hunter.',
    traits: ['Predator', 'Fast flyer', 'Territorial'],
    size: 'large',
    colorProfile: { hueRange: [180, 230], brightnessRange: [0.30, 0.55], saturationRange: [0.40, 0.80] },
  },
  // ─── Legendary ─────────────────────────────────────────
  {
    name: 'Atlas Moth',
    species: 'Attacus atlas',
    rarity: 'legendary',
    biome: 'forest',
    description: 'One of the largest moths in the world, with stunning wing patterns.',
    traits: ['Massive', 'Nocturnal', 'Short-lived', 'Majestic'],
    size: 'huge',
    colorProfile: { hueRange: [10, 35], brightnessRange: [0.30, 0.55], saturationRange: [0.35, 0.70] },
  },
  {
    name: 'Hercules Beetle',
    species: 'Dynastes hercules',
    rarity: 'legendary',
    biome: 'forest',
    description: 'The longest beetle on Earth, incredibly strong relative to its size.',
    traits: ['Massive', 'Strong', 'Horned', 'Impressive'],
    size: 'huge',
    colorProfile: { hueRange: [50, 90], brightnessRange: [0.30, 0.55], saturationRange: [0.25, 0.55] },
  },
];