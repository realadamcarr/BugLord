/**
 * Hive Mode Battle Service
 * 
 * Handles turn-based battle logic for Hive Mode
 * - Turn execution (player attack, enemy attack)
 * - HP management
 * - Item usage (catch, heal, revive)
 * - Battle state transitions
 * - Item drops from defeated enemies
 */

import { Bug } from '@/types/Bug';
import {
    BattleBug,
    BattleTurn,
    calculateBugStats,
    ENEMY_BUG_TEMPLATES,
    HiveRound
} from '@/types/HiveMode';

/** Items that can drop from defeated enemies */
const ENEMY_DROP_TABLE = [
  { itemId: 'item_potion', weight: 40 },
  { itemId: 'item_super_potion', weight: 20 },
  { itemId: 'item_bug_trap', weight: 25 },
  { itemId: 'item_revive_seed', weight: 12 },
  { itemId: 'item_full_revive', weight: 3 },
] as const;

/** Chance (0-1) that a defeated enemy drops an item */
const ENEMY_DROP_CHANCE = 0.35;

export class HiveBattleService {
  // Convert player Bug to BattleBug for battle system
  static createPlayerBattleBug(bug: Bug): BattleBug {
    return {
      id: bug.id,
      name: bug.nickname || bug.name,
      level: bug.level,
      maxHp: bug.maxXp, // Using maxXp as HP proxy for MVP
      currentHp: bug.maxXp,
      attack: Math.floor(10 + bug.level * 2), // Simple attack calculation
      sprite: bug.pixelArt || bug.photo,
      isEnemy: false,
    };
  }

  // Create enemy bug for a round
  static createEnemyBug(round: HiveRound): BattleBug {
    const template = ENEMY_BUG_TEMPLATES[round.enemyType];
    const stats = calculateBugStats(template, round.enemyLevel);
    
    return {
      id: `enemy-${round.roundNumber}-${Date.now()}`,
      name: template.name,
      level: round.enemyLevel,
      maxHp: stats.maxHp,
      currentHp: stats.maxHp,
      attack: stats.attack,
      sprite: template.sprite,
      isEnemy: true,
    };
  }

  // Execute player attack turn
  static executePlayerAttack(playerBug: BattleBug, enemyBug: BattleBug): {
    damage: number;
    enemyHpRemaining: number;
  } {
    // Simple damage calculation with variance
    const variance = 0.85 + Math.random() * 0.3; // 85% - 115% damage
    const damage = Math.max(1, Math.floor(playerBug.attack * variance));
    const enemyHpRemaining = Math.max(0, enemyBug.currentHp - damage);
    
    console.log(`[Battle] ${playerBug.name} attacks ${enemyBug.name} for ${damage} damage`);
    
    return { damage, enemyHpRemaining };
  }

  // Execute enemy attack turn
  static executeEnemyAttack(enemyBug: BattleBug, playerBug: BattleBug): {
    damage: number;
    playerHpRemaining: number;
  } {
    // Simple damage calculation with variance
    const variance = 0.85 + Math.random() * 0.3; // 85% - 115% damage
    const damage = Math.max(1, Math.floor(enemyBug.attack * variance));
    const playerHpRemaining = Math.max(0, playerBug.currentHp - damage);
    
    console.log(`[Battle] ${enemyBug.name} attacks ${playerBug.name} for ${damage} damage`);
    
    return { damage, playerHpRemaining };
  }

  /**
   * Attempt to catch enemy bug using a Bug Trap.
   * Fixed 40% base success rate.
   */
  static attemptCatch(enemyBug: BattleBug): {
    success: boolean;
    catchChance: number;
  } {
    const catchChance = 0.4; // Fixed 40% catch rate
    const success = Math.random() < catchChance;
    
    console.log(`[Battle] Catch attempt: ${(catchChance * 100).toFixed(1)}% chance - ${success ? 'SUCCESS' : 'FAILED'}`);
    
    return { success, catchChance };
  }

  // Heal player bug
  static healBug(bug: BattleBug, amount: number): number {
    const healedHp = Math.min(bug.maxHp, bug.currentHp + amount);
    const actualHealing = healedHp - bug.currentHp;
    
    console.log(`[Battle] ${bug.name} healed for ${actualHealing} HP (${bug.currentHp} -> ${healedHp})`);
    
    return healedHp;
  }

  // Revive fainted bug
  static reviveBug(bug: BattleBug): BattleBug {
    const revivedHp = Math.floor(bug.maxHp * 0.5); // Revive at 50% HP
    
    console.log(`[Battle] ${bug.name} revived with ${revivedHp} HP`);
    
    return {
      ...bug,
      currentHp: revivedHp,
    };
  }

  // Convert enemy BattleBug to collectible Bug
  static convertEnemyToBug(enemyBug: BattleBug): Bug {
    // Determine rarity based on level
    let rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common';
    if (enemyBug.level >= 18) rarity = 'legendary';
    else if (enemyBug.level >= 14) rarity = 'epic';
    else if (enemyBug.level >= 10) rarity = 'rare';
    else if (enemyBug.level >= 6) rarity = 'uncommon';

    return {
      id: `caught-${enemyBug.id}`,
      name: enemyBug.name.replace('Wild ', '').replace('Boss ', ''),
      species: enemyBug.name.replace('Wild ', '').replace('Boss ', ''),
      description: `A wild bug caught in the Hive at Level ${enemyBug.level}.`,
      rarity,
      biome: 'forest',
      level: enemyBug.level,
      xp: 0,
      maxXp: enemyBug.maxHp,
      xpValue: enemyBug.level * 10,
      traits: [`Caught at Level ${enemyBug.level}`],
      size: 'medium' as const,
      caughtAt: new Date(),
      capturedAt: new Date().toISOString(),
      pixelArt: enemyBug.sprite,
    };
  }

  /**
   * Roll for an item drop after defeating an enemy.
   * Returns the item ID or null if nothing dropped.
   */
  static rollItemDrop(): string | null {
    if (Math.random() > ENEMY_DROP_CHANCE) return null;

    const totalWeight = ENEMY_DROP_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of ENEMY_DROP_TABLE) {
      roll -= entry.weight;
      if (roll <= 0) return entry.itemId;
    }
    return ENEMY_DROP_TABLE[0].itemId;
  }

  // Check if battle is over
  static isBattleOver(playerBug: BattleBug, enemyBug: BattleBug): {
    isOver: boolean;
    playerWon: boolean;
    enemyDefeated: boolean;
    playerDefeated: boolean;
  } {
    const enemyDefeated = enemyBug.currentHp <= 0;
    const playerDefeated = playerBug.currentHp <= 0;
    const isOver = enemyDefeated || playerDefeated;
    
    return {
      isOver,
      playerWon: enemyDefeated && !playerDefeated,
      enemyDefeated,
      playerDefeated,
    };
  }

  // Create battle turn log entry
  static createTurnLog(options: {
    roundNumber: number;
    turnNumber: number;
    playerAction: string;
    playerDamage: number;
    enemyDamage: number;
    playerHpRemaining: number;
    enemyHpRemaining: number;
    itemUsed?: string;
    catchAttempt?: boolean;
    catchSuccess?: boolean;
  }): BattleTurn {
    return {
      roundNumber: options.roundNumber,
      turnNumber: options.turnNumber,
      playerAction: options.playerAction as any,
      playerDamage: options.playerDamage,
      enemyDamage: options.enemyDamage,
      playerHpRemaining: options.playerHpRemaining,
      enemyHpRemaining: options.enemyHpRemaining,
      itemUsed: options.itemUsed,
      catchAttempt: options.catchAttempt,
      catchSuccess: options.catchSuccess,
    };
  }
}
