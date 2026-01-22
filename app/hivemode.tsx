/**
 * Hive Mode Screen
 * 
 * Turn-based bug battle mode for BugLord MVP
 * - Select bug to fight
 * - 10 rounds max
 * - Use items (trap, heal, revive)
 * - Boss encounter on final round
 */

import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getItemDefinition } from '@/constants/Items';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useTheme } from '@/contexts/ThemeContext';
import { HiveBattleService } from '@/services/HiveBattleService';
import { Bug } from '@/types/Bug';
import { BattleBug, BattleTurn, generateHiveRounds, HiveRound, HiveRunState } from '@/types/HiveMode';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function HiveModeScreen() {
  const { theme } = useTheme();
  const { collection, addBugToCollection, gainXP, updateBugHp } = useBugCollection();
  const { inventory, useItem: consumeItem } = useInventory();
  const styles = createStyles(theme);

  // Animation refs
  const playerAnimX = useRef(new Animated.Value(0)).current;
  const playerAnimY = useRef(new Animated.Value(0)).current;
  const enemyAnimX = useRef(new Animated.Value(0)).current;
  const enemyAnimY = useRef(new Animated.Value(0)).current;

  // Hive run state
  const [hiveState, setHiveState] = useState<HiveRunState>({
    isActive: false,
    currentRound: 0,
    maxRounds: 10,
    playerBug: null,
    enemyBug: null,
    battleLog: [],
    bugsCaught: [],
    roundsWon: 0,
    isPlayerTurn: true,
    runCompleted: false,
    runWon: false,
  });

  const [rounds, setRounds] = useState<HiveRound[]>([]);
  const [showBugSelector, setShowBugSelector] = useState(false);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [battleMessage, setBattleMessage] = useState<string>('');
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);

  // Initialize rounds when component mounts
  useEffect(() => {
    if (rounds.length === 0) {
      setRounds(generateHiveRounds(10));
    }
  }, []);

  // Start a new Hive run
  const startHiveRun = (selectedBug: Bug) => {
    // Check if bug has HP
    const maxHp = selectedBug.maxHp || selectedBug.maxXp;
    const currentHp = selectedBug.currentHp !== undefined ? selectedBug.currentHp : maxHp;
    
    if (currentHp <= 0) {
      Alert.alert(
        'Bug Fainted',
        `${selectedBug.nickname || selectedBug.name} has 0 HP and cannot battle! Use a Heal or Revive item first.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    console.log('[Hive] Starting new run with', selectedBug.name);
    
    const playerBattleBug: BattleBug = {
      id: selectedBug.id,
      name: selectedBug.nickname || selectedBug.name,
      level: selectedBug.level,
      maxHp,
      currentHp,
      attack: Math.floor(10 + selectedBug.level * 2),
      sprite: selectedBug.pixelArt || selectedBug.photo,
      isEnemy: false,
    };
    
    const firstRound = rounds[0];
    const enemyBattleBug = HiveBattleService.createEnemyBug(firstRound);

    setHiveState({
      isActive: true,
      currentRound: 1,
      maxRounds: 10,
      playerBug: playerBattleBug,
      enemyBug: enemyBattleBug,
      battleLog: [],
      bugsCaught: [],
      roundsWon: 0,
      isPlayerTurn: true,
      runCompleted: false,
      runWon: false,
    });

    setBattleMessage(`Round 1: ${enemyBattleBug.name} appears!`);
    setShowBugSelector(false);
  };

  // Execute player attack action
  const executeAttack = () => {
    if (!hiveState.playerBug || !hiveState.enemyBug || isProcessingTurn) return;
    
    setIsProcessingTurn(true);
    
    // Animate player bug attacking enemy
    Animated.sequence([
      Animated.parallel([
        Animated.timing(playerAnimX, {
          toValue: screenWidth * 0.3,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(playerAnimY, {
          toValue: -20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(playerAnimX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(playerAnimY, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    
    // Player attacks
    const { damage: playerDamage, enemyHpRemaining } = HiveBattleService.executePlayerAttack(
      hiveState.playerBug,
      hiveState.enemyBug
    );
    
    const updatedEnemyBug = { ...hiveState.enemyBug, currentHp: enemyHpRemaining };
    
    setBattleMessage(`${hiveState.playerBug.name} attacks for ${playerDamage} damage!`);
    
    // Check if enemy defeated
    if (enemyHpRemaining <= 0) {
      handleRoundVictory(playerDamage, updatedEnemyBug);
      return;
    }
    
    // Enemy counterattacks after delay
    setTimeout(() => {
      executeEnemyTurn(playerDamage, updatedEnemyBug);
    }, 1000);
  };

  // Execute enemy attack
  const executeEnemyTurn = (playerDamage: number, updatedEnemyBug: BattleBug) => {
    if (!hiveState.playerBug) return;
    
    // Animate enemy bug attacking player
    Animated.sequence([
      Animated.parallel([
        Animated.timing(enemyAnimX, {
          toValue: -screenWidth * 0.3,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(enemyAnimY, {
          toValue: 20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(enemyAnimX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(enemyAnimY, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    
    const { damage: enemyDamage, playerHpRemaining } = HiveBattleService.executeEnemyAttack(
      updatedEnemyBug,
      hiveState.playerBug
    );
    
    const updatedPlayerBug = { ...hiveState.playerBug, currentHp: playerHpRemaining };
    
    setBattleMessage(`${updatedEnemyBug.name} attacks for ${enemyDamage} damage!`);
    
    // Log turn
    const turnLog = HiveBattleService.createTurnLog({
      roundNumber: hiveState.currentRound,
      turnNumber: hiveState.battleLog.length + 1,
      playerAction: 'attack',
      playerDamage,
      enemyDamage,
      playerHpRemaining,
      enemyHpRemaining: updatedEnemyBug.currentHp,
    });
    
    // Check if player defeated
    if (playerHpRemaining <= 0) {
      handlePlayerDefeat(updatedPlayerBug, updatedEnemyBug, turnLog);
      return;
    }
    
    // Update state for next turn
    setHiveState(prev => ({
      ...prev,
      playerBug: updatedPlayerBug,
      enemyBug: updatedEnemyBug,
      battleLog: [...prev.battleLog, turnLog],
      isPlayerTurn: true,
    }));
    
    setIsProcessingTurn(false);
  };

  // Handle round victory
  const handleRoundVictory = (playerDamage: number, defeatedEnemy: BattleBug) => {
    console.log('[Hive] Round victory! Round:', hiveState.currentRound);
    
    const newRoundsWon = hiveState.roundsWon + 1;
    
    // Award XP to player
    const xpGained = Math.floor(defeatedEnemy.level * 10);
    gainXP(xpGained);
    
    setBattleMessage(`Victory! ${defeatedEnemy.name} defeated! +${xpGained} XP`);
    
    // Check if run completed
    if (hiveState.currentRound >= hiveState.maxRounds) {
      setTimeout(() => {
        handleRunCompletion(true);
      }, 2000);
      return;
    }
    
    // Advance to next round
    setTimeout(() => {
      advanceToNextRound(newRoundsWon);
    }, 2000);
  };

  // Advance to next round
  const advanceToNextRound = (roundsWon: number) => {
    const nextRoundNumber = hiveState.currentRound + 1;
    const nextRound = rounds[nextRoundNumber - 1];
    
    if (!nextRound) {
      handleRunCompletion(true);
      return;
    }
    
    const newEnemyBug = HiveBattleService.createEnemyBug(nextRound);
    
    // Restore player HP slightly between rounds
    const restoredHp = Math.min(
      hiveState.playerBug!.maxHp,
      hiveState.playerBug!.currentHp + Math.floor(hiveState.playerBug!.maxHp * 0.2)
    );
    
    // Persist HP after each round
    if (hiveState.playerBug) {
      updateBugHp(hiveState.playerBug.id, restoredHp);
    }
    
    setHiveState(prev => ({
      ...prev,
      currentRound: nextRoundNumber,
      enemyBug: newEnemyBug,
      playerBug: prev.playerBug ? { ...prev.playerBug, currentHp: restoredHp } : null,
      roundsWon,
      isPlayerTurn: true,
    }));
    
    setBattleMessage(
      nextRound.isBoss
        ? `Final Round: BOSS ${newEnemyBug.name} appears!`
        : `Round ${nextRoundNumber}: ${newEnemyBug.name} appears!`
    );
    
    setIsProcessingTurn(false);
  };

  // Handle player defeat
  const handlePlayerDefeat = (
    defeatedPlayer: BattleBug,
    enemy: BattleBug,
    turnLog: BattleTurn
  ) => {
    console.log('[Hive] Player defeated');
    
    // Persist HP to collection
    updateBugHp(defeatedPlayer.id, 0);
    
    setBattleMessage(`${defeatedPlayer.name} fainted!`);
    
    setHiveState(prev => ({
      ...prev,
      playerBug: defeatedPlayer,
      enemyBug: enemy,
      battleLog: [...prev.battleLog, turnLog],
      isPlayerTurn: false,
    }));
    
    setIsProcessingTurn(false);
    
    // Show defeat options after delay
    setTimeout(() => {
      Alert.alert(
        'Bug Fainted!',
        'Your bug fainted! Use a Revive item or end the run.',
        [
          {
            text: 'Use Revive',
            onPress: () => {
              tryRevive().catch(console.error);
            },
          },
          {
            text: 'End Run',
            onPress: () => handleRunCompletion(false),
            style: 'destructive',
          },
        ]
      );
    }, 1000);
  };

  // Attempt to revive player bug
  const tryRevive = async () => {
    const reviveSlot = inventory.find(slot => slot.itemId === 'revive-item' && slot.quantity > 0);
    
    if (!reviveSlot || !hiveState.playerBug) {
      Alert.alert('No Revive Items', 'You don\'t have any Revive items!');
      handleRunCompletion(false);
      return;
    }
    
    const revivedBug = HiveBattleService.reviveBug(hiveState.playerBug);
    await consumeItem('revive-item');
    
    setHiveState(prev => ({
      ...prev,
      playerBug: revivedBug,
      isPlayerTurn: true,
    }));
    
    setBattleMessage(`${revivedBug.name} was revived!`);
  };

  // Handle item usage
  const handleUseItem = async (itemId: string) => {
    if (!hiveState.playerBug || !hiveState.enemyBug || isProcessingTurn) return;
    
    setIsProcessingTurn(true);
    setShowItemSelector(false);
    
    // Bug Trap - attempt to catch
    if (itemId === 'bug-trap') {
      const { success, catchChance } = HiveBattleService.attemptCatch(hiveState.enemyBug);
      
      await consumeItem(itemId);
      
      if (success) {
        const caughtBug = HiveBattleService.convertEnemyToBug(hiveState.enemyBug);
        addBugToCollection(caughtBug);
        
        setBattleMessage(`Caught ${hiveState.enemyBug.name}!`);
        
        setHiveState(prev => ({
          ...prev,
          bugsCaught: [...prev.bugsCaught, caughtBug],
        }));
        
        // Treat as round victory
        setTimeout(() => {
          handleRoundVictory(0, hiveState.enemyBug!);
        }, 2000);
      } else {
        setBattleMessage(`Catch failed! (${(catchChance * 100).toFixed(0)}% chance)`);
        
        // Enemy attacks after failed catch
        setTimeout(() => {
          executeEnemyTurn(0, hiveState.enemyBug!);
        }, 1500);
      }
    }
    
    // Heal Item
    else if (itemId === 'heal-item') {
      const healAmount = Math.floor(hiveState.playerBug.maxHp * 0.5);
      const newHp = HiveBattleService.healBug(hiveState.playerBug, healAmount);
      
      await consumeItem(itemId);
      
      const updatedPlayerBug = { ...hiveState.playerBug, currentHp: newHp };
      
      setBattleMessage(`${hiveState.playerBug.name} healed for ${healAmount} HP!`);
      
      // Enemy attacks after heal
      setTimeout(() => {
        executeEnemyTurn(0, hiveState.enemyBug!);
      }, 1500);
      
      setHiveState(prev => ({
        ...prev,
        playerBug: updatedPlayerBug,
      }));
    }
  };

  // Handle run completion
  const handleRunCompletion = (won: boolean) => {
    console.log('[Hive] Run completed. Won:', won);
    
    // Persist final HP to collection
    if (hiveState.playerBug) {
      updateBugHp(hiveState.playerBug.id, hiveState.playerBug.currentHp);
    }
    
    const totalXp = hiveState.roundsWon * 50;
    
    setHiveState(prev => ({
      ...prev,
      isActive: false,
      runCompleted: true,
      runWon: won,
    }));
    
    Alert.alert(
      won ? 'Hive Run Complete!' : 'Hive Run Ended',
      won
        ? `Congratulations! You defeated all ${hiveState.maxRounds} rounds!\n\nRounds Won: ${hiveState.roundsWon}\nBugs Caught: ${hiveState.bugsCaught.length}\nBonus XP: +${totalXp}`
        : `Run ended at round ${hiveState.currentRound}.\n\nRounds Won: ${hiveState.roundsWon}\nBugs Caught: ${hiveState.bugsCaught.length}`,
      [
        {
          text: 'OK',
          onPress: () => {
            if (won) gainXP(totalXp);
            router.back();
          },
        },
      ]
    );
  };

  // Render bug selector modal
  const renderBugSelector = () => {
    const availableBugs = [
      ...collection.party.filter(bug => bug !== null),
      ...collection.bugs.filter(bug => !collection.party.some(partyBug => partyBug?.id === bug.id))
    ].filter(bug => {
      // Only show bugs with HP > 0
      const maxHp = bug.maxHp || bug.maxXp;
      const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
      return currentHp > 0;
    });

    return (
      <Modal visible={showBugSelector} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Your Fighter</ThemedText>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowBugSelector(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bugList}>
            {availableBugs.map(bug => (
              <TouchableOpacity
                key={bug.id}
                style={styles.bugListItem}
                onPress={() => startHiveRun(bug)}
              >
                {bug.photo ? (
                  <Image source={{ uri: bug.photo }} style={styles.bugListPhoto} />
                ) : bug.pixelArt ? (
                  <Image source={{ uri: bug.pixelArt }} style={styles.bugListPhoto} />
                ) : (
                  <View style={styles.bugListPhoto}>
                    <PixelatedEmoji type="bug" size={24} color={theme.colors.text} />
                  </View>
                )}
                <View style={styles.bugListInfo}>
                  <ThemedText style={styles.bugListName}>{bug.nickname || bug.name}</ThemedText>
                  <ThemedText style={styles.bugListDetails}>
                    Level {bug.level} • HP: {bug.currentHp !== undefined ? bug.currentHp : (bug.maxHp || bug.maxXp)}/{bug.maxHp || bug.maxXp} • ATK: {10 + bug.level * 2}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Render item selector modal
  const renderItemSelector = () => {
    const usableItemIds = ['bug-trap', 'heal-item', 'revive-item'];
    const usableSlots = inventory.filter(
      slot => slot.quantity > 0 && usableItemIds.includes(slot.itemId)
    );

    return (
      <Modal visible={showItemSelector} animationType="fade" transparent>
        <View style={styles.itemModalOverlay}>
          <View style={styles.itemModalContent}>
            <ThemedText style={styles.itemModalTitle}>Use Item</ThemedText>
            
            {usableSlots.length === 0 ? (
              <ThemedText style={styles.noItemsText}>No usable items!</ThemedText>
            ) : (
              usableSlots.map(slot => {
                const itemDef = getItemDefinition(slot.itemId);
                if (!itemDef) return null;
                const emoji = slot.itemId === 'bug-trap' ? '🪤' : slot.itemId === 'heal-item' ? '💊' : '✨';
                return (
                  <TouchableOpacity
                    key={slot.itemId}
                    style={styles.itemSlotButton}
                    onPress={() => handleUseItem(slot.itemId)}
                  >
                    <Text style={styles.itemEmoji}>{emoji}</Text>
                    <View style={styles.itemInfo}>
                      <ThemedText style={styles.itemName}>{itemDef.name}</ThemedText>
                      <ThemedText style={styles.itemQuantity}>x{slot.quantity}</ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowItemSelector(false)}
            >
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Pre-battle screen
  if (!hiveState.isActive && !hiveState.runCompleted) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Hive Mode</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.welcomeSection}>
            <PixelatedEmoji type="hive" size={64} color={theme.colors.primary} />
            
            <ThemedText style={styles.welcomeTitle}>Enter the Hive</ThemedText>
            <ThemedText style={styles.welcomeDescription}>
              Battle through 10 rounds of increasingly difficult wild bugs!
            </ThemedText>
          </View>

          <View style={styles.rulesSection}>
            <ThemedText style={styles.rulesTitle}>Rules:</ThemedText>
            <ThemedText style={styles.ruleText}>• 10 rounds, scaling difficulty</ThemedText>
            <ThemedText style={styles.ruleText}>• Final round is a Boss battle</ThemedText>
            <ThemedText style={styles.ruleText}>• Use items to catch, heal, or revive</ThemedText>
            <ThemedText style={styles.ruleText}>• Defeat all rounds to win!</ThemedText>
          </View>

          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setShowBugSelector(true)}
          >
            <PixelatedEmoji type="bug" size={24} color="#ffffff" />
            <ThemedText style={styles.startButtonText}>Select Fighter</ThemedText>
          </TouchableOpacity>
        </ScrollView>

        {renderBugSelector()}
      </ThemedView>
    );
  }

  // Battle screen
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>
          Round {hiveState.currentRound}/{hiveState.maxRounds}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.battleContainer}>
        {/* Enemy Bug */}
        <View style={styles.enemySection}>
          <ThemedText style={styles.bugName}>
            {hiveState.enemyBug?.name} Lv.{hiveState.enemyBug?.level}
          </ThemedText>
          <View style={styles.hpBar}>
            <View
              style={[
                styles.hpBarFill,
                {
                  width: `${((hiveState.enemyBug?.currentHp || 0) / (hiveState.enemyBug?.maxHp || 1)) * 100}%`,
                  backgroundColor: '#EF4444',
                },
              ]}
            />
          </View>
          <ThemedText style={styles.hpText}>
            HP: {hiveState.enemyBug?.currentHp}/{hiveState.enemyBug?.maxHp}
          </ThemedText>
          
          <Animated.View style={[
            styles.bugSprite,
            {
              transform: [
                { translateX: enemyAnimX },
                { translateY: enemyAnimY },
              ],
            },
          ]}>
            <Text style={styles.enemySprite}>{hiveState.enemyBug?.sprite}</Text>
          </Animated.View>
        </View>

        {/* Battle Message */}
        <View style={styles.messageBox}>
          <ThemedText style={styles.messageText}>{battleMessage}</ThemedText>
        </View>

        {/* Player Bug */}
        <View style={styles.playerSection}>
          <Animated.View style={[
            styles.bugSprite,
            {
              transform: [
                { translateX: playerAnimX },
                { translateY: playerAnimY },
              ],
            },
          ]}>
            {hiveState.playerBug?.sprite ? (
              typeof hiveState.playerBug.sprite === 'string' &&
              hiveState.playerBug.sprite.startsWith('data:') ? (
                <Image source={{ uri: hiveState.playerBug.sprite }} style={styles.playerBugImage} />
              ) : (
                <Text style={styles.playerSprite}>{hiveState.playerBug.sprite}</Text>
              )
            ) : (
              <PixelatedEmoji type="bug" size={48} color={theme.colors.text} />
            )}
          </Animated.View>
          
          <ThemedText style={styles.bugName}>
            {hiveState.playerBug?.name} Lv.{hiveState.playerBug?.level}
          </ThemedText>
          <View style={styles.hpBar}>
            <View
              style={[
                styles.hpBarFill,
                {
                  width: `${((hiveState.playerBug?.currentHp || 0) / (hiveState.playerBug?.maxHp || 1)) * 100}%`,
                  backgroundColor: '#10B981',
                },
              ]}
            />
          </View>
          <ThemedText style={styles.hpText}>
            HP: {hiveState.playerBug?.currentHp}/{hiveState.playerBug?.maxHp}
          </ThemedText>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.attackButton]}
            onPress={executeAttack}
            disabled={!hiveState.isPlayerTurn || isProcessingTurn}
          >
            <ThemedText style={styles.actionButtonText}>⚔️ Attack</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.itemButton]}
            onPress={() => setShowItemSelector(true)}
            disabled={!hiveState.isPlayerTurn || isProcessingTurn}
          >
            <ThemedText style={styles.actionButtonText}>🎒 Items</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <ThemedText style={styles.statText}>Rounds Won: {hiveState.roundsWon}</ThemedText>
          <ThemedText style={styles.statText}>Bugs Caught: {hiveState.bugsCaught.length}</ThemedText>
        </View>
      </ScrollView>

      {renderItemSelector()}
    </ThemedView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#8B5CF6', // Purple theme for Hive Mode
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeDescription: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  rulesSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  rulesTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  ruleText: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.9,
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  battleContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  enemySection: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  playerSection: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  bugName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  hpBar: {
    width: '100%',
    height: 20,
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  hpBarFill: {
    height: '100%',
    borderRadius: 10,
  },
  hpText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  bugSprite: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  enemySprite: {
    fontSize: 64,
  },
  playerSprite: {
    fontSize: 48,
  },
  playerBugImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  messageBox: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    minHeight: 60,
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: 'white',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attackButton: {
    backgroundColor: '#EF4444',
  },
  itemButton: {
    backgroundColor: '#3B82F6',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  bugList: {
    flex: 1,
    padding: 20,
  },
  bugListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  bugListPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  bugListInfo: {
    flex: 1,
  },
  bugListName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bugListDetails: {
    fontSize: 12,
    opacity: 0.7,
  },
  itemModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemModalContent: {
    width: screenWidth - 80,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  itemModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  noItemsText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 16,
  },
  itemSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemQuantity: {
    fontSize: 14,
    opacity: 0.7,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
