// Bug Collector - Core Types and Interfaces

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
  photo?: string; // Base64 or file path
  pixelArt?: string; // Pixelized version for collection view
  
  // Stats and traits
  xpValue: number;
  traits: string[];
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  
  // Metadata
  caughtAt: Date;
  location?: string;
  weather?: string;
  
  // Game stats
  level: number;
  xp: number;
  maxXp: number;
}

export interface BugCollection {
  bugs: Bug[];
  party: (Bug | null)[]; // Array of 6 slots, null for empty slots
  totalXp: number;
  level: number;
  xp: number;
}

export interface BugIdentificationResult {
  confidence: number;
  possibleSpecies: {
    name: string;
    species: string;
    confidence: number;
    rarity: BugRarity;
    biome: BiomeType;
    description: string;
  }[];
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

// Helper function to generate random bug stats
export const generateBugStats = (rarity: BugRarity): { xp: number; maxXp: number; level: number } => {
  const config = RARITY_CONFIG[rarity];
  const baseXp = Math.floor(Math.random() * (config.xpRange[1] - config.xpRange[0]) + config.xpRange[0]);
  return {
    xp: 0,
    maxXp: baseXp,
    level: 1,
  };
};

// Sample bug database (for AI fallback)
export const SAMPLE_BUGS = [
  {
    name: 'Garden Beetle',
    species: 'Carabidae family',
    rarity: 'common' as BugRarity,
    biome: 'garden' as BiomeType,
    description: 'A common ground beetle found in gardens and parks.',
    traits: ['Ground dweller', 'Nocturnal', 'Beneficial'],
    size: 'small' as const,
  },
  {
    name: 'Azure Butterfly',
    species: 'Lycaenidae',
    rarity: 'uncommon' as BugRarity,
    biome: 'meadow' as BiomeType,
    description: 'Beautiful blue butterfly with metallic wings.',
    traits: ['Day active', 'Pollinator', 'Delicate'],
    size: 'medium' as const,
  },
  {
    name: 'Forest Stag Beetle',
    species: 'Lucanus cervus',
    rarity: 'rare' as BugRarity,
    biome: 'forest' as BiomeType,
    description: 'Impressive beetle with large mandibles resembling antlers.',
    traits: ['Strong', 'Territorial', 'Long-lived'],
    size: 'large' as const,
  },
];