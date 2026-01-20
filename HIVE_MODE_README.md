# Hive Mode - Turn-Based Bug Battle System

## Overview
Hive Mode is a turn-based battle system for the BugLord MVP thesis demonstration. Players fight through 10 rounds of wild bugs with scaling difficulty, culminating in a boss battle.

## Features

### Battle System
- **Turn-based combat**: Player attacks, then enemy attacks
- **HP and Attack stats**: Simple damage calculation with variance
- **10 rounds max**: Difficulty scales from level 2 (round 1) to level 20 (final boss)

### Enemy Types
- **Regular Bugs**: Ant, Bee, Wasp, Fly
- **Boss Bug**: Centipede (final round only)

### Player Actions
1. **Attack**: Deal damage to enemy bug
2. **Use Item**: Access inventory during battle
   - **Bug Trap**: Attempt to catch enemy (20% base chance, higher if enemy HP is low)
   - **Heal Item**: Restore 50% of player bug's HP
   - **Revive Item**: Revive fainted bug at 50% HP

### Catch Mechanics
- Base catch rate: 20%
- Bonus +15% if enemy HP < 50%
- Bonus +15% if enemy HP < 25%
- Maximum catch rate: 50%

### Victory Conditions
- **Round Victory**: Defeat enemy bug → advance to next round
- **Run Completion**: Defeat all 10 rounds including boss
- **Run Failure**: Player bug faints and no revives available

### Rewards
- **XP per round**: 10 × enemy level
- **Bonus XP**: 50 × rounds won (on completion)
- **Caught bugs**: Added to collection with appropriate rarity

## Implementation

### Files
- `types/HiveMode.ts` - Type definitions and constants
- `services/HiveBattleService.ts` - Battle logic (damage, catch, heal, etc.)
- `app/hivemode.tsx` - UI and battle screen

### Integration Points
- Uses `BugCollectionContext` for bug management
- Uses `InventoryContext` for item usage
- Reuses `Bug` type with HP mapped to `maxXp`
- Attack stat calculated as: `10 + (level × 2)`

### Scaling Formula
- **Enemy HP**: `baseHP × (1 + (level - 1) × 0.15)`
- **Enemy Attack**: `baseAttack × (1 + (level - 1) × 0.1)`
- **Round level**: Scales from 2 to ~18, then boss at 20

## Design Decisions

### Simplicity for MVP
- No animations or complex UI transitions
- Text-based battle messages
- Simple button interface
- No online/multiplayer features

### Readable Architecture
- Clear separation: UI (screen) vs Logic (service)
- State logging for debugging
- Modular turn execution
- Documented calculations

### Reusability
- Leverages existing inventory system
- Uses standard Bug data model
- Integrates with collection context
- Compatible with theme system

## Future Enhancements (Post-MVP)
- Battle animations
- Sound effects
- More enemy types
- Special moves/abilities
- Multiplayer battles
- Leaderboards
- Daily challenges

## Testing Notes
- Test with different bug levels
- Verify catch rate calculations
- Check HP restoration between rounds
- Confirm boss spawn on round 10
- Validate item consumption
