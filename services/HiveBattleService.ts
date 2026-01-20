/**
 * Hive Mode Battle Service
 * 
 * Handles turn-based battle logic for Hive Mode
 * - Turn execution (player attack, enemy attack)
 * - HP management
 * - Item usage (catch, heal, revive)
 * - Battle state transitions
 */

import { Bug } from '@/types/Bug';
import {
    BattleBug,
    BattleTurn,
    calculateBugStats,
    ENEMY_BUG_TEMPLATES,
    HiveRound
} from '@/types/HiveMode';

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

  // Attempt to catch enemy bug
  static attemptCatch(enemyBug: BattleBug): {
    success: boolean;
    catchChance: number;
  } {
    // Base catch chance: 20%
    let catchChance = 0.2;
    
    // Increase chance if enemy HP is low
    const hpPercent = enemyBug.currentHp / enemyBug.maxHp;
    if (hpPercent < 0.5) {
      catchChance += 0.15; // +15% if below 50% HP
    }
    if (hpPercent < 0.25) {
      catchChance += 0.15; // +15% more if below 25% HP
    }
    
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
      rarity,
      biome: 'forest',
      level: enemyBug.level,
      xp: 0,
      maxXp: enemyBug.maxHp,
      traits: [`Caught at Level ${enemyBug.level}`],
      captureDate: new Date().toISOString(),
      pixelArt: enemyBug.sprite,
    };
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
