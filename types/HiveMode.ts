/**
 * Hive Mode Type Definitions
 * 
 * Turn-based bug battle system for BugLord MVP
 */

import { Bug } from './Bug';

export type EnemyBugType = 'ant' | 'bee' | 'wasp' | 'fly' | 'centipede';

export interface BattleBug {
  id: string;
  name: string;
  level: number;
  maxHp: number;
  currentHp: number;
  attack: number;
  sprite?: string;
  isEnemy: boolean;
}

export interface HiveRound {
  roundNumber: number;
  enemyType: EnemyBugType;
  enemyLevel: number;
  isBoss: boolean;
}

export type BattleAction = 'attack' | 'item' | 'switch' | 'run';

export interface BattleTurn {
  roundNumber: number;
  turnNumber: number;
  playerAction: BattleAction;
  playerDamage: number;
  enemyDamage: number;
  playerHpRemaining: number;
  enemyHpRemaining: number;
  itemUsed?: string;
  switchedTo?: string;
  catchAttempt?: boolean;
  catchSuccess?: boolean;
}

export interface HiveRunState {
  isActive: boolean;
  currentRound: number;
  maxRounds: number;
  playerBug: BattleBug | null;
  enemyBug: BattleBug | null;
  battleLog: BattleTurn[];
  bugsCaught: Bug[];
  roundsWon: number;
  isPlayerTurn: boolean;
  runCompleted: boolean;
  runWon: boolean;
}

export const ENEMY_BUG_TEMPLATES: Record<EnemyBugType, {
  name: string;
  baseHp: number;
  baseAttack: number;
  sprite: string;
}> = {
  ant: {
    name: 'Wild Ant',
    baseHp: 30,
    baseAttack: 5,
    sprite: '🐜',
  },
  bee: {
    name: 'Wild Bee',
    baseHp: 25,
    baseAttack: 7,
    sprite: '🐝',
  },
  wasp: {
    name: 'Wild Wasp',
    baseHp: 28,
    baseAttack: 8,
    sprite: '🐝', // Using bee emoji as fallback
  },
  fly: {
    name: 'Wild Fly',
    baseHp: 20,
    baseAttack: 4,
    sprite: '🪰',
  },
  centipede: {
    name: 'Boss Centipede',
    baseHp: 80,
    baseAttack: 15,
    sprite: '🐛',
  },
};

// Calculate stats based on level
export const calculateBugStats = (template: typeof ENEMY_BUG_TEMPLATES[EnemyBugType], level: number) => {
  return {
    maxHp: Math.floor(template.baseHp * (1 + (level - 1) * 0.15)),
    attack: Math.floor(template.baseAttack * (1 + (level - 1) * 0.1)),
  };
};

// Round progression: scales difficulty from level 2 to level 20
export const generateHiveRounds = (maxRounds: number = 10): HiveRound[] => {
  const rounds: HiveRound[] = [];
  const regularEnemies: EnemyBugType[] = ['fly', 'ant', 'bee', 'wasp'];
  
  for (let i = 1; i <= maxRounds; i++) {
    if (i === maxRounds) {
      // Final round is always boss
      rounds.push({
        roundNumber: i,
        enemyType: 'centipede',
        enemyLevel: 20,
        isBoss: true,
      });
    } else {
      // Regular enemies with scaling levels (2 to ~18)
      const enemyType = regularEnemies[Math.floor(Math.random() * regularEnemies.length)];
      const scaledLevel = Math.max(2, Math.floor(2 + (i - 1) * 1.8));
      
      rounds.push({
        roundNumber: i,
        enemyType,
        enemyLevel: scaledLevel,
        isBoss: false,
      });
    }
  }
  
  return rounds;
};
