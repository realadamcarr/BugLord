/**
 * Hive Mode Screen
 *
 * Turn-based bug battle mode for BugLord
 * - Only party bugs with >0 HP can enter
 * - Bugs keep their current HP (no full heal)
 * - Edit party before entering
 * - Bug Traps catch at 40% → nickname prompt
 * - Defeated enemies can drop items
 * - End-of-run summary (caught, defeated, items used/gained)
 */

import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getItemDefinition } from '@/constants/Items';
import { BUG_SPRITE } from '@/constants/bugSprites';
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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

/** Helper: get currentHp with fallback to maxHp */
const getBugHp = (bug: Bug): { currentHp: number; maxHp: number } => {
  const maxHp = bug.maxHp || bug.maxXp;
  const currentHp = bug.currentHp ?? maxHp;
  return { currentHp, maxHp };
};

/** Helper: render a bug sprite (category sprite / photo / pixelArt / fallback) */
const BugSpriteImage = ({ bug, style, fallbackSize, theme }: { bug: Bug; style: any; fallbackSize: number; theme: any }) => {
  if (bug.category && BUG_SPRITE[bug.category]) return <Image source={BUG_SPRITE[bug.category]} style={style} />;
  if (bug.photo) return <Image source={{ uri: bug.photo }} style={style} />;
  if (bug.pixelArt) return <Image source={{ uri: bug.pixelArt }} style={style} />;
  return (
    <View style={style}>
      <PixelatedEmoji type="bug" size={fallbackSize} color={theme.colors.text} />
    </View>
  );
};

/** Helper: HP bar color */
const hpColor = (percent: number) => {
  if (percent > 50) return '#10B981';
  if (percent > 25) return '#F59E0B';
  return '#EF4444';
};

/** Helper: render a battle bug sprite (string URI or emoji) */
const BattleSpriteImage = ({ sprite, imageStyle, emojiStyle }: { sprite?: string; imageStyle: any; emojiStyle: any }) => {
  if (typeof sprite === 'string' && sprite.startsWith('category:')) {
    const category = sprite.replace('category:', '') as keyof typeof BUG_SPRITE;
    if (BUG_SPRITE[category]) {
      return <Image source={BUG_SPRITE[category]} style={imageStyle} />;
    }
  }

  if (
    typeof sprite === 'string' &&
    (
      sprite.startsWith('data:') ||
      sprite.startsWith('file:') ||
      sprite.startsWith('http') ||
      sprite.startsWith('blob:') ||
      sprite.startsWith('content:') ||
      sprite.startsWith('asset:')
    )
  ) {
    return <Image source={{ uri: sprite }} style={imageStyle} />;
  }
  return <Text style={emojiStyle}>{sprite ?? '🐛'}</Text>;
};

export default function HiveModeScreen() {
  const { theme } = useTheme();
  const {
    collection,
    addBugToCollection,
    addBugToParty,
    removeBugFromParty,
    updateBugNickname,
    addXpToBug,
    gainXP,
    updateBugHp,
  } = useBugCollection();
  const { inventory, useItem: consumeItem, addItem } = useInventory();
  const styles = createStyles(theme);

  // ── Animation refs ──
  const playerAnimX = useRef(new Animated.Value(0)).current;
  const playerAnimY = useRef(new Animated.Value(0)).current;
  const enemyAnimX = useRef(new Animated.Value(0)).current;
  const enemyAnimY = useRef(new Animated.Value(0)).current;

  // ── Core state ──
  const [hiveState, setHiveState] = useState<HiveRunState>({
    isActive: false,
    currentRound: 0,
    maxRounds: 10,
    playerBug: null,
    enemyBug: null,
    battleLog: [],
    bugsCaught: [],
    bugsDefeated: [],
    itemsUsed: [],
    itemsGained: [],
    roundsWon: 0,
    isPlayerTurn: true,
    runCompleted: false,
    runWon: false,
  });

  const [rounds, setRounds] = useState<HiveRound[]>([]);
  const [showBugSelector, setShowBugSelector] = useState(false);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [showSwitchSelector, setShowSwitchSelector] = useState(false);
  const [showPartyEditor, setShowPartyEditor] = useState(false);
  const [showRunSummary, setShowRunSummary] = useState(false);
  const [battleMessage, setBattleMessage] = useState('');
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [faintedBugIds, setFaintedBugIds] = useState<Set<string>>(new Set());
  const [partyBugHp, setPartyBugHp] = useState<Record<string, { current: number; max: number }>>({});
  const [forcedSwitch, setForcedSwitch] = useState(false);

  // Nickname prompt state
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [pendingCaughtBug, setPendingCaughtBug] = useState<Bug | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');

  // ── Init rounds ──
  useEffect(() => {
    if (rounds.length === 0) {
      setRounds(generateHiveRounds(10));
    }
  }, []);

  // ═══════════════════════════════════════
  //  START RUN — no full-heal, party only
  // ═══════════════════════════════════════
  const startHiveRun = (selectedBug: Bug) => {
    const { currentHp, maxHp } = getBugHp(selectedBug);

    if (currentHp <= 0) {
      Alert.alert('Bug Fainted', `${selectedBug.nickname || selectedBug.name} has 0 HP and cannot enter Hive Mode!`);
      return;
    }

    console.log('[Hive] Starting run with', selectedBug.name, 'HP:', currentHp, '/', maxHp);

    const playerBattleBug: BattleBug = {
      id: selectedBug.id,
      name: selectedBug.nickname || selectedBug.name,
      level: selectedBug.level,
      maxHp,
      currentHp, // Use actual HP — no full heal
      attack: Math.floor(10 + selectedBug.level * 2),
      sprite:
        (selectedBug.category ? `category:${selectedBug.category}` : undefined) ||
        selectedBug.pixelArt ||
        selectedBug.photo,
      isEnemy: false,
    };

    const firstRound = rounds[0];
    const enemyBattleBug = HiveBattleService.createEnemyBug(firstRound);

    // Build HP map from real party HP — no healing
    const hpMap: Record<string, { current: number; max: number }> = {};
    collection.party.forEach(bug => {
      if (bug) {
        const hp = getBugHp(bug);
        hpMap[bug.id] = { current: hp.currentHp, max: hp.maxHp };
      }
    });

    // Mark already-fainted bugs
    const alreadyFainted = new Set<string>();
    collection.party.forEach(bug => {
      if (bug) {
        const cHp = hpMap[bug.id]?.current ?? 0;
        if (cHp <= 0) alreadyFainted.add(bug.id);
      }
    });

    setPartyBugHp(hpMap);
    setFaintedBugIds(alreadyFainted);
    setForcedSwitch(false);

    setHiveState({
      isActive: true,
      currentRound: 1,
      maxRounds: 10,
      playerBug: playerBattleBug,
      enemyBug: enemyBattleBug,
      battleLog: [],
      bugsCaught: [],
      bugsDefeated: [],
      itemsUsed: [],
      itemsGained: [],
      roundsWon: 0,
      isPlayerTurn: true,
      runCompleted: false,
      runWon: false,
    });

    setBattleMessage(`Round 1: ${enemyBattleBug.name} appears!`);
    setShowBugSelector(false);
  };

  // ═══════════════════════════════
  //  ATTACK
  // ═══════════════════════════════
  const executeAttack = () => {
    if (!hiveState.playerBug || !hiveState.enemyBug || isProcessingTurn) return;

    setIsProcessingTurn(true);

    // Animate player lunge
    Animated.sequence([
      Animated.parallel([
        Animated.timing(playerAnimX, { toValue: screenWidth * 0.3, duration: 300, useNativeDriver: true }),
        Animated.timing(playerAnimY, { toValue: -20, duration: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(playerAnimX, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(playerAnimY, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
    ]).start();

    const { damage: playerDamage, enemyHpRemaining } = HiveBattleService.executePlayerAttack(
      hiveState.playerBug,
      hiveState.enemyBug,
    );

    const updatedEnemyBug = { ...hiveState.enemyBug, currentHp: enemyHpRemaining };
    setBattleMessage(`${hiveState.playerBug.name} attacks for ${playerDamage} damage!`);

    if (enemyHpRemaining <= 0) {
      handleRoundVictory(playerDamage, updatedEnemyBug);
      return;
    }

    setTimeout(() => {
      executeEnemyTurn(playerDamage, updatedEnemyBug);
    }, 1000);
  };

  // ═══════════════════════════════
  //  ENEMY TURN
  // ═══════════════════════════════
  const executeEnemyTurn = (playerDamage: number, updatedEnemyBug: BattleBug) => {
    if (!hiveState.playerBug) return;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(enemyAnimX, { toValue: -screenWidth * 0.3, duration: 300, useNativeDriver: true }),
        Animated.timing(enemyAnimY, { toValue: 20, duration: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(enemyAnimX, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(enemyAnimY, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
    ]).start();

    const { damage: enemyDamage, playerHpRemaining } = HiveBattleService.executeEnemyAttack(
      updatedEnemyBug,
      hiveState.playerBug,
    );

    const updatedPlayerBug = { ...hiveState.playerBug, currentHp: playerHpRemaining };
    setBattleMessage(`${updatedEnemyBug.name} attacks for ${enemyDamage} damage!`);

    const turnLog = HiveBattleService.createTurnLog({
      roundNumber: hiveState.currentRound,
      turnNumber: hiveState.battleLog.length + 1,
      playerAction: 'attack',
      playerDamage,
      enemyDamage,
      playerHpRemaining,
      enemyHpRemaining: updatedEnemyBug.currentHp,
    });

    if (playerHpRemaining <= 0) {
      handlePlayerDefeat(updatedPlayerBug, updatedEnemyBug, turnLog);
      return;
    }

    setHiveState(prev => ({
      ...prev,
      playerBug: updatedPlayerBug,
      enemyBug: updatedEnemyBug,
      battleLog: [...prev.battleLog, turnLog],
      isPlayerTurn: true,
    }));
    setIsProcessingTurn(false);
  };

  // ═══════════════════════════════
  //  ROUND VICTORY + item drop
  // ═══════════════════════════════
  const handleRoundVictory = (playerDamage: number, defeatedEnemy: BattleBug) => {
    console.log('[Hive] Round victory! Round:', hiveState.currentRound);

    const newRoundsWon = hiveState.roundsWon + 1;
    const xpGained = Math.floor(defeatedEnemy.level * 10);
    gainXP(xpGained);

    // Grant XP to the active fighting bug so it can level up
    if (hiveState.playerBug) {
      addXpToBug(hiveState.playerBug.id, xpGained);
      // Persist current HP after the round
      updateBugHp(hiveState.playerBug.id, hiveState.playerBug.currentHp);
    }

    // Roll for item drop
    const droppedItemId = HiveBattleService.rollItemDrop();
    let dropMsg = '';
    if (droppedItemId) {
      const itemDef = getItemDefinition(droppedItemId);
      if (itemDef) {
        addItem(droppedItemId, 1);
        dropMsg = `\n${defeatedEnemy.name} dropped ${itemDef.name}!`;
        setHiveState(prev => ({
          ...prev,
          itemsGained: [...prev.itemsGained, { id: droppedItemId, name: itemDef.name }],
        }));
      }
    }

    // Track defeated enemy
    setHiveState(prev => ({
      ...prev,
      bugsDefeated: [...prev.bugsDefeated, defeatedEnemy.name],
      roundsWon: newRoundsWon,
    }));

    setBattleMessage(`Victory! ${defeatedEnemy.name} defeated! +${xpGained} XP${dropMsg}`);

    if (hiveState.currentRound >= hiveState.maxRounds) {
      setTimeout(() => handleRunCompletion(true), 2500);
      return;
    }

    setTimeout(() => advanceToNextRound(newRoundsWon), 2500);
  };

  // ═══════════════════════════════
  //  NEXT ROUND
  // ═══════════════════════════════
  const advanceToNextRound = (roundsWon: number) => {
    const nextRoundNumber = hiveState.currentRound + 1;
    const nextRound = rounds[nextRoundNumber - 1];

    if (!nextRound) {
      handleRunCompletion(true);
      return;
    }

    const newEnemyBug = HiveBattleService.createEnemyBug(nextRound);

    // Restore 20% HP between rounds
    const restoredHp = Math.min(
      hiveState.playerBug!.maxHp,
      hiveState.playerBug!.currentHp + Math.floor(hiveState.playerBug!.maxHp * 0.2),
    );

    if (hiveState.playerBug) {
      updateBugHp(hiveState.playerBug.id, restoredHp);
      setPartyBugHp(prev => ({
        ...prev,
        [hiveState.playerBug!.id]: { ...prev[hiveState.playerBug!.id], current: restoredHp },
      }));
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
        : `Round ${nextRoundNumber}: ${newEnemyBug.name} appears!`,
    );
    setIsProcessingTurn(false);
  };

  // ═══════════════════════════════
  //  PLAYER DEFEAT
  // ═══════════════════════════════
  const handlePlayerDefeat = (defeatedPlayer: BattleBug, enemy: BattleBug, turnLog: BattleTurn) => {
    console.log('[Hive] Player bug defeated:', defeatedPlayer.name);

    updateBugHp(defeatedPlayer.id, 0);

    const newFaintedIds = new Set(faintedBugIds);
    newFaintedIds.add(defeatedPlayer.id);
    setFaintedBugIds(newFaintedIds);
    setPartyBugHp(prev => ({
      ...prev,
      [defeatedPlayer.id]: { ...prev[defeatedPlayer.id], current: 0 },
    }));

    setBattleMessage(`${defeatedPlayer.name} fainted!`);

    setHiveState(prev => ({
      ...prev,
      playerBug: { ...defeatedPlayer, currentHp: 0 },
      enemyBug: enemy,
      battleLog: [...prev.battleLog, turnLog],
      isPlayerTurn: false,
    }));
    setIsProcessingTurn(false);

    // Check alive party bugs
    const aliveBugs = collection.party.filter(bug => {
      if (!bug) return false;
      if (bug.id === defeatedPlayer.id) return false;
      if (newFaintedIds.has(bug.id)) return false;
      const hp = partyBugHp[bug.id];
      if (hp && hp.current <= 0) return false;
      if (!hp) {
        const fallback = getBugHp(bug);
        return fallback.currentHp > 0;
      }
      return true;
    });

    setTimeout(() => {
      if (aliveBugs.length > 0) {
        setForcedSwitch(true);
        setShowSwitchSelector(true);
      } else {
        setBattleMessage('All your party bugs have fainted...');
        handleRunCompletion(false);
      }
    }, 1200);
  };

  // ═══════════════════════════════
  //  SWITCH BUG — party only
  // ═══════════════════════════════
  const switchBug = (newBug: Bug) => {
    if (!hiveState.enemyBug) return;

    const maxHp = partyBugHp[newBug.id]?.max || newBug.maxHp || newBug.maxXp;
    const fallbackHp = getBugHp(newBug);
    const currentHp = partyBugHp[newBug.id]?.current ?? fallbackHp.currentHp;

    if (currentHp <= 0) {
      Alert.alert('Bug Fainted', `${newBug.nickname || newBug.name} has 0 HP and cannot battle!`);
      return;
    }

    // Save current bug's HP
    if (hiveState.playerBug && hiveState.playerBug.currentHp > 0) {
      updateBugHp(hiveState.playerBug.id, hiveState.playerBug.currentHp);
      setPartyBugHp(prev => ({
        ...prev,
        [hiveState.playerBug!.id]: { ...prev[hiveState.playerBug!.id], current: hiveState.playerBug!.currentHp },
      }));
    }

    const newBattleBug: BattleBug = {
      id: newBug.id,
      name: newBug.nickname || newBug.name,
      level: newBug.level,
      maxHp,
      currentHp,
      attack: Math.floor(10 + newBug.level * 2),
      sprite:
        (newBug.category ? `category:${newBug.category}` : undefined) ||
        newBug.pixelArt ||
        newBug.photo,
      isEnemy: false,
    };

    const wasForcedSwitch = forcedSwitch;
    setShowSwitchSelector(false);
    setForcedSwitch(false);

    setBattleMessage(`Go, ${newBattleBug.name}!`);
    setHiveState(prev => ({ ...prev, playerBug: newBattleBug, isPlayerTurn: true }));

    if (wasForcedSwitch) {
      setIsProcessingTurn(false);
    } else {
      setIsProcessingTurn(true);
      setTimeout(() => executeEnemyTurn(0, hiveState.enemyBug!), 1000);
    }
  };

  // ═══════════════════════════════
  //  USE ITEM — correct item IDs
  // ═══════════════════════════════
  const handleUseItem = async (itemId: string) => {
    if (!hiveState.playerBug || !hiveState.enemyBug || isProcessingTurn) return;

    setIsProcessingTurn(true);
    setShowItemSelector(false);

    const itemDef = getItemDefinition(itemId);
    const itemName = itemDef?.name ?? itemId;

    // Track item usage
    setHiveState(prev => ({
      ...prev,
      itemsUsed: [...prev.itemsUsed, { id: itemId, name: itemName }],
    }));

    // ── Bug Trap ──
    if (itemDef?.type === 'trap') {
      const { success, catchChance } = HiveBattleService.attemptCatch(hiveState.enemyBug);
      await consumeItem(itemId);

      if (success) {
        const caughtBug = HiveBattleService.convertEnemyToBug(hiveState.enemyBug);

        setBattleMessage(`Caught ${hiveState.enemyBug.name}! 🎉`);
        setHiveState(prev => ({ ...prev, bugsCaught: [...prev.bugsCaught, caughtBug] }));

        // Show nickname prompt
        setPendingCaughtBug(caughtBug);
        setNicknameInput('');
        setNicknameModalVisible(true);
        // Round-advance logic is called after the nickname modal closes
      } else {
        setBattleMessage(`Catch failed! (${(catchChance * 100).toFixed(0)}% chance)`);
        setTimeout(() => executeEnemyTurn(0, hiveState.enemyBug!), 1500);
      }
      return;
    }

    // ── Heal items (Potion / Super Potion) ──
    if (itemDef?.type === 'heal') {
      const healAmount = itemDef.effect.healAmount ?? Math.floor(hiveState.playerBug.maxHp * 0.5);
      const newHp = HiveBattleService.healBug(hiveState.playerBug, healAmount);
      await consumeItem(itemId);

      const updatedPlayerBug = { ...hiveState.playerBug, currentHp: newHp };
      setBattleMessage(`${hiveState.playerBug.name} healed for ${healAmount} HP!`);

      setHiveState(prev => ({ ...prev, playerBug: updatedPlayerBug }));
      setTimeout(() => executeEnemyTurn(0, hiveState.enemyBug!), 1500);
      return;
    }

    // ── Revive items ──
    if (itemDef?.type === 'revive') {
      const faintedPartyBugs = collection.party.filter(bug => {
        if (!bug) return false;
        if (faintedBugIds.has(bug.id)) return true;
        const hp = partyBugHp[bug.id];
        return hp && hp.current <= 0;
      }) as Bug[];

      if (faintedPartyBugs.length === 0) {
        Alert.alert('No Fainted Bugs', 'No party bugs need reviving!');
        setIsProcessingTurn(false);
        return;
      }

      const target = faintedPartyBugs[0];
      const mHp = partyBugHp[target.id]?.max || target.maxHp || target.maxXp;
      const revivePercent = itemDef.effect.reviveHpPercent ?? 0.5;
      const revivedHp = Math.floor(mHp * revivePercent);

      await consumeItem(itemId);
      updateBugHp(target.id, revivedHp);

      const newFainted = new Set(faintedBugIds);
      newFainted.delete(target.id);
      setFaintedBugIds(newFainted);
      setPartyBugHp(prev => ({ ...prev, [target.id]: { ...prev[target.id], current: revivedHp } }));

      setBattleMessage(`${target.nickname || target.name} revived with ${revivedHp} HP!`);
      setTimeout(() => executeEnemyTurn(0, hiveState.enemyBug!), 1500);
      return;
    }

    // Fallback
    setIsProcessingTurn(false);
  };

  // ═══════════════════════════════
  //  NICKNAME prompt callback
  // ═══════════════════════════════
  const handleNicknameConfirm = async () => {
    if (!pendingCaughtBug) return;

    const addedBug = await addBugToCollection(pendingCaughtBug);

    if (nicknameInput.trim()) {
      updateBugNickname(addedBug.id, nicknameInput.trim());
    }

    setNicknameModalVisible(false);
    setPendingCaughtBug(null);

    // Continue: treat catch as round victory
    if (hiveState.enemyBug) {
      setTimeout(() => handleRoundVictory(0, hiveState.enemyBug!), 500);
    }
  };

  // ═══════════════════════════════
  //  RUN COMPLETION → summary
  // ═══════════════════════════════
  const handleRunCompletion = (won: boolean) => {
    console.log('[Hive] Run completed. Won:', won);

    // Persist HP for the active bug
    if (hiveState.playerBug) {
      updateBugHp(hiveState.playerBug.id, hiveState.playerBug.currentHp);
    }

    // Persist HP for all party bugs tracked during the run
    Object.entries(partyBugHp).forEach(([bugId, hp]) => {
      if (bugId !== hiveState.playerBug?.id) {
        updateBugHp(bugId, hp.current);
      }
    });

    const totalXp = hiveState.roundsWon * 50;
    if (won) gainXP(totalXp);

    setHiveState(prev => ({
      ...prev,
      isActive: false,
      runCompleted: true,
      runWon: won,
    }));

    setShowRunSummary(true);
  };

  // ═══════════════════════════════
  //  ABANDON RUN (Exit Run)
  // ═══════════════════════════════
  const handleAbandonRun = () => {
    Alert.alert(
      'Exit Run',
      'Are you sure? Your bugs will keep any damage taken and fainted bugs stay fainted until revived.',
      [
        { text: 'Keep Fighting', style: 'cancel' },
        {
          text: 'Exit Run',
          style: 'destructive',
          onPress: () => {
            // Persist current active bug HP
            if (hiveState.playerBug) {
              updateBugHp(hiveState.playerBug.id, hiveState.playerBug.currentHp);
            }

            // Persist HP for all party bugs tracked during the run
            Object.entries(partyBugHp).forEach(([bugId, hp]) => {
              if (bugId !== hiveState.playerBug?.id) {
                updateBugHp(bugId, hp.current);
              }
            });

            // Fainted bugs stay at 0 HP (already persisted via updateBugHp)
            faintedBugIds.forEach(bugId => {
              updateBugHp(bugId, 0);
            });

            setHiveState(prev => ({
              ...prev,
              isActive: false,
              runCompleted: true,
              runWon: false,
            }));

            setShowRunSummary(true);
          },
        },
      ],
    );
  };

  // ═══════════════════════════════════════════
  //  RENDER: Bug selector (party only, no heal)
  // ═══════════════════════════════════════════
  const renderBugSelector = () => {
    const partyBugs = collection.party.filter((b): b is Bug => b !== null);

    return (
      <Modal visible={showBugSelector} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Your Fighter</ThemedText>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowBugSelector(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ThemedText style={{ textAlign: 'center', opacity: 0.6, fontSize: 13, marginBottom: 8, paddingHorizontal: 16 }}>
            Only party bugs with HP &gt; 0 can enter. Bugs keep their current HP.
          </ThemedText>

          <ScrollView style={styles.bugList}>
            {partyBugs.length === 0 && (
              <ThemedText style={styles.noItemsText}>Your party is empty! Add bugs to your party first.</ThemedText>
            )}
            {partyBugs.map(bug => {
              const hp = getBugHp(bug);
              const isFainted = hp.currentHp <= 0;
              return (
                <TouchableOpacity
                  key={bug.id}
                  style={[styles.bugListItem, isFainted && { opacity: 0.4 }]}
                  onPress={() => {
                    if (isFainted) {
                      Alert.alert('Bug Fainted', `${bug.nickname || bug.name} has 0 HP and cannot enter Hive Mode!`);
                    } else {
                      startHiveRun(bug);
                    }
                  }}
                  disabled={isFainted}
                >
                  <BugSpriteImage bug={bug} style={styles.bugListPhoto} fallbackSize={24} theme={theme} />
                  <View style={styles.bugListInfo}>
                    <ThemedText style={styles.bugListName}>
                      {bug.nickname || bug.name}{isFainted ? ' 💀' : ''}
                    </ThemedText>
                    <ThemedText style={styles.bugListDetails}>
                      Level {bug.level} • {isFainted ? 'FAINTED' : `HP: ${hp.currentHp}/${hp.maxHp}`} • ATK: {10 + bug.level * 2}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // ═══════════════════════════════════════════
  //  RENDER: Item selector — correct catalog IDs
  // ═══════════════════════════════════════════
  const renderItemSelector = () => {
    const usableSlots = inventory.filter(slot => {
      if (slot.quantity <= 0) return false;
      const def = getItemDefinition(slot.itemId);
      if (!def) return false;
      return ['trap', 'heal', 'revive'].includes(def.type);
    });

    const getItemEmoji = (type: string) => {
      if (type === 'trap') return '🪤';
      if (type === 'heal') return '💊';
      if (type === 'revive') return '✨';
      return '📦';
    };

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
                return (
                  <TouchableOpacity
                    key={slot.itemId}
                    style={styles.itemSlotButton}
                    onPress={() => handleUseItem(slot.itemId)}
                  >
                    <Text style={styles.itemEmoji}>{getItemEmoji(itemDef.type)}</Text>
                    <View style={styles.itemInfo}>
                      <ThemedText style={styles.itemName}>{itemDef.name}</ThemedText>
                      <ThemedText style={styles.itemQuantity}>x{slot.quantity}</ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowItemSelector(false)}>
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ═══════════════════════════════════════════
  //  RENDER: Switch selector — party only
  // ═══════════════════════════════════════════
  const renderSwitchSelector = () => {
    const switchableBugs = collection.party.filter(bug => {
      if (!bug) return false;
      if (bug.id === hiveState.playerBug?.id) return false;
      if (faintedBugIds.has(bug.id)) return false;
      const hp = partyBugHp[bug.id];
      if (hp && hp.current <= 0) return false;
      if (!hp) {
        const fallback = getBugHp(bug);
        if (fallback.currentHp <= 0) return false;
      }
      return true;
    }) as Bug[];

    return (
      <Modal visible={showSwitchSelector} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.itemModalOverlay}
          activeOpacity={1}
          onPress={() => { if (!forcedSwitch) setShowSwitchSelector(false); }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.switchModalContent}>
            <ThemedText style={styles.itemModalTitle}>
              {forcedSwitch ? 'Choose Next Bug' : 'Switch Bug'}
            </ThemedText>
            {forcedSwitch && (
              <ThemedText style={styles.switchSubtitle}>
                Your bug fainted! Select another party bug to continue.
              </ThemedText>
            )}

            {switchableBugs.length === 0 ? (
              <View>
                <ThemedText style={styles.noItemsText}>No available party bugs to switch to!</ThemedText>
                <TouchableOpacity
                  style={styles.endRunButton}
                  onPress={() => { setShowSwitchSelector(false); handleRunCompletion(false); }}
                >
                  <ThemedText style={styles.endRunButtonText}>End Run</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {switchableBugs.map(bug => {
                  const hp = partyBugHp[bug.id];
                  const maxHp = hp?.max || bug.maxHp || bug.maxXp;
                  const fallback = getBugHp(bug);
                  const currentHp = hp?.current ?? fallback.currentHp;
                  const hpPercent = Math.round((currentHp / maxHp) * 100);

                  return (
                    <TouchableOpacity key={bug.id} style={styles.switchBugItem} onPress={() => switchBug(bug)}>
                      <BugSpriteImage bug={bug} style={styles.switchBugPhoto} fallbackSize={20} theme={theme} />
                      <View style={styles.switchBugInfo}>
                        <ThemedText style={styles.switchBugName}>{bug.nickname || bug.name}</ThemedText>
                        <View style={styles.switchBugHpRow}>
                          <ThemedText style={styles.switchBugLevel}>Lv.{bug.level}</ThemedText>
                          <View style={styles.switchBugHpBar}>
                            <View
                              style={[
                                styles.switchBugHpFill,
                                {
                                  width: `${hpPercent}%`,
                                  backgroundColor: hpColor(hpPercent),
                                },
                              ]}
                            />
                          </View>
                          <ThemedText style={styles.switchBugHpText}>{currentHp}/{maxHp}</ThemedText>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                if (forcedSwitch) {
                  setShowSwitchSelector(false);
                  handleRunCompletion(false);
                } else {
                  setShowSwitchSelector(false);
                }
              }}
            >
              <ThemedText style={styles.cancelButtonText}>{forcedSwitch ? 'Forfeit Run' : 'Cancel'}</ThemedText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ═══════════════════════════════════════════
  //  RENDER: Nickname modal
  // ═══════════════════════════════════════════
  const renderNicknameModal = () => (
    <Modal visible={nicknameModalVisible} animationType="fade" transparent>
      <View style={styles.itemModalOverlay}>
        <View style={styles.itemModalContent}>
          <ThemedText style={styles.itemModalTitle}>Bug Caught! 🎉</ThemedText>
          <ThemedText style={{ textAlign: 'center', marginBottom: 12, color: theme.colors.textSecondary, fontSize: 13 }}>
            Give {pendingCaughtBug?.name} a nickname? (Leave blank to skip)
          </ThemedText>
          <TextInput
            style={{
              borderWidth: 2,
              borderColor: theme.colors.border,
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              marginBottom: 14,
            }}
            placeholder="Enter nickname…"
            placeholderTextColor={theme.colors.textMuted}
            value={nicknameInput}
            onChangeText={setNicknameInput}
            maxLength={20}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.startButton, { marginBottom: 0 }]}
            onPress={handleNicknameConfirm}
          >
            <ThemedText style={styles.startButtonText}>
              {nicknameInput.trim() ? 'Confirm Nickname' : 'Skip'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ═══════════════════════════════════════════
  //  RENDER: Party editor modal
  // ═══════════════════════════════════════════
  const renderPartyEditor = () => {
    const nonPartyBugs = collection.bugs.filter(
      bug => !collection.party.some(p => p?.id === bug.id),
    );

    return (
      <Modal visible={showPartyEditor} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Edit Party</ThemedText>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowPartyEditor(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bugList}>
            <ThemedText style={[styles.sectionLabel, { color: theme.colors.primary }]}>Current Party</ThemedText>
            {collection.party.map((bug, idx) => {
              if (!bug) {
                return (
                  <View key={`empty-slot-${String(idx)}`} style={[styles.bugListItem, { opacity: 0.4 }]}>
                    <View style={styles.bugListPhoto}>
                      <ThemedText style={{ fontSize: 18 }}>—</ThemedText>
                    </View>
                    <ThemedText style={{ flex: 1, fontWeight: '600', color: theme.colors.textMuted }}>
                      Empty Slot {idx + 1}
                    </ThemedText>
                  </View>
                );
              }
              const hp = getBugHp(bug);
              return (
                <View key={bug.id} style={styles.bugListItem}>
                  <BugSpriteImage bug={bug} style={styles.bugListPhoto} fallbackSize={24} theme={theme} />
                  <View style={styles.bugListInfo}>
                    <ThemedText style={styles.bugListName}>{bug.nickname || bug.name}</ThemedText>
                    <ThemedText style={styles.bugListDetails}>
                      Lv.{bug.level} • HP: {hp.currentHp}/{hp.maxHp}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: theme.colors.error,
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                    onPress={() => removeBugFromParty(idx)}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 11 }}>REMOVE</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {nonPartyBugs.length > 0 && (
              <>
                <ThemedText style={[styles.sectionLabel, { color: theme.colors.warning, marginTop: 16 }]}>
                  Collection (tap to add)
                </ThemedText>
                {nonPartyBugs.map(bug => {
                  const partyFull = collection.party.every(p => p !== null);
                  const hp = getBugHp(bug);
                  return (
                    <TouchableOpacity
                      key={bug.id}
                      style={[styles.bugListItem, partyFull && { opacity: 0.4 }]}
                      disabled={partyFull}
                      onPress={() => addBugToParty(bug)}
                    >
                      <BugSpriteImage bug={bug} style={styles.bugListPhoto} fallbackSize={24} theme={theme} />
                      <View style={styles.bugListInfo}>
                        <ThemedText style={styles.bugListName}>{bug.nickname || bug.name}</ThemedText>
                        <ThemedText style={styles.bugListDetails}>
                          Lv.{bug.level} • HP: {hp.currentHp}/{hp.maxHp}
                        </ThemedText>
                      </View>
                      {!partyFull && (
                        <Text style={{ fontSize: 18, color: theme.colors.primary, fontWeight: '900' }}>+</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // ═══════════════════════════════════════════
  //  RENDER: End-of-run summary
  // ═══════════════════════════════════════════
  const renderRunSummary = () => {
    const totalXp = hiveState.roundsWon * 50;

    // Aggregate items used
    const usedCounts: Record<string, { name: string; count: number }> = {};
    hiveState.itemsUsed.forEach(i => {
      if (usedCounts[i.id]) usedCounts[i.id].count++;
      else usedCounts[i.id] = { name: i.name, count: 1 };
    });
    // Aggregate items gained
    const gainedCounts: Record<string, { name: string; count: number }> = {};
    hiveState.itemsGained.forEach(i => {
      if (gainedCounts[i.id]) gainedCounts[i.id].count++;
      else gainedCounts[i.id] = { name: i.name, count: 1 };
    });

    return (
      <Modal visible={showRunSummary} animationType="slide" transparent>
        <View style={styles.itemModalOverlay}>
          <View style={[styles.itemModalContent, { maxHeight: '80%' }]}>
            <ThemedText style={[styles.itemModalTitle, { fontSize: 20 }]}>
              {hiveState.runWon ? '🏆 Hive Run Complete!' : '💀 Run Ended'}
            </ThemedText>

            <ScrollView style={{ marginBottom: 10 }}>
              {/* Rounds */}
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>Rounds Won</ThemedText>
                <ThemedText style={styles.summaryValue}>{hiveState.roundsWon} / {hiveState.maxRounds}</ThemedText>
              </View>

              {hiveState.runWon && (
                <View style={styles.summaryRow}>
                  <ThemedText style={styles.summaryLabel}>Bonus XP</ThemedText>
                  <ThemedText style={[styles.summaryValue, { color: '#10B981' }]}>+{totalXp}</ThemedText>
                </View>
              )}

              {/* Bugs defeated */}
              <ThemedText style={styles.summarySection}>Bugs Defeated ({hiveState.bugsDefeated.length})</ThemedText>
              {hiveState.bugsDefeated.length === 0 ? (
                <ThemedText style={styles.summaryEmpty}>None</ThemedText>
              ) : (
                hiveState.bugsDefeated.map((name, i) => (
                  <ThemedText key={`def-${name}-${String(i)}`} style={styles.summaryListItem}>⚔️ {name}</ThemedText>
                ))
              )}

              {/* Bugs caught */}
              <ThemedText style={styles.summarySection}>Bugs Caught ({hiveState.bugsCaught.length})</ThemedText>
              {hiveState.bugsCaught.length === 0 ? (
                <ThemedText style={styles.summaryEmpty}>None</ThemedText>
              ) : (
                hiveState.bugsCaught.map((bug, i) => (
                  <ThemedText key={`cat-${bug.id}`} style={styles.summaryListItem}>🪤 {bug.nickname || bug.name} (Lv.{bug.level})</ThemedText>
                ))
              )}

              {/* Items used */}
              <ThemedText style={styles.summarySection}>Items Used ({hiveState.itemsUsed.length})</ThemedText>
              {Object.keys(usedCounts).length === 0 ? (
                <ThemedText style={styles.summaryEmpty}>None</ThemedText>
              ) : (
                Object.values(usedCounts).map(entry => (
                  <ThemedText key={entry.name} style={styles.summaryListItem}>📦 {entry.name} ×{entry.count}</ThemedText>
                ))
              )}

              {/* Items gained */}
              <ThemedText style={styles.summarySection}>Items Gained ({hiveState.itemsGained.length})</ThemedText>
              {Object.keys(gainedCounts).length === 0 ? (
                <ThemedText style={styles.summaryEmpty}>None</ThemedText>
              ) : (
                Object.values(gainedCounts).map(entry => (
                  <ThemedText key={entry.name} style={styles.summaryListItem}>🎁 {entry.name} ×{entry.count}</ThemedText>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.startButton, { marginTop: 4 }]}
              onPress={() => {
                setShowRunSummary(false);
                router.back();
              }}
            >
              <ThemedText style={styles.startButtonText}>Done</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ═══════════════════════════════════════════
  //  PRE-BATTLE SCREEN
  // ═══════════════════════════════════════════
  if (!hiveState.isActive && !hiveState.runCompleted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
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
            <ThemedText style={styles.ruleText}>• Only party bugs with HP can enter</ThemedText>
            <ThemedText style={styles.ruleText}>• Bugs keep their current HP — no full heal</ThemedText>
            <ThemedText style={styles.ruleText}>• Use Bug Traps to catch wild bugs (40%)</ThemedText>
            <ThemedText style={styles.ruleText}>• Defeated enemies may drop items</ThemedText>
          </View>

          {/* Edit Party button */}
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: theme.colors.primary, borderColor: `${theme.colors.primary}80`, marginBottom: 12 }]}
            onPress={() => setShowPartyEditor(true)}
          >
            <ThemedText style={styles.startButtonText}>✏️ Edit Party</ThemedText>
          </TouchableOpacity>

          {/* Enter Hive button */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setShowBugSelector(true)}
          >
            <PixelatedEmoji type="bug" size={24} color="#ffffff" />
            <ThemedText style={styles.startButtonText}>Enter Hive</ThemedText>
          </TouchableOpacity>
        </ScrollView>

        {renderBugSelector()}
        {renderPartyEditor()}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════
  //  BATTLE SCREEN
  // ═══════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
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

          <Animated.View style={[styles.bugSprite, { transform: [{ translateX: enemyAnimX }, { translateY: enemyAnimY }] }]}>
            <BattleSpriteImage
              sprite={hiveState.enemyBug?.sprite}
              imageStyle={styles.enemyBugImage}
              emojiStyle={styles.enemySprite}
            />
          </Animated.View>
        </View>

        {/* Battle Message */}
        <View style={styles.messageBox}>
          <ThemedText style={styles.messageText}>{battleMessage}</ThemedText>
        </View>

        {/* Player Bug */}
        <View style={styles.playerSection}>
          <Animated.View style={[styles.bugSprite, { transform: [{ translateX: playerAnimX }, { translateY: playerAnimY }] }]}>
            <BattleSpriteImage
              sprite={hiveState.playerBug?.sprite}
              imageStyle={styles.playerBugImage}
              emojiStyle={styles.playerSprite}
            />
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
            style={[styles.actionButton, styles.switchButton]}
            onPress={() => { setForcedSwitch(false); setShowSwitchSelector(true); }}
            disabled={!hiveState.isPlayerTurn || isProcessingTurn}
          >
            <ThemedText style={styles.actionButtonText}>🔄 Switch</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.itemButton]}
            onPress={() => setShowItemSelector(true)}
            disabled={!hiveState.isPlayerTurn || isProcessingTurn}
          >
            <ThemedText style={styles.actionButtonText}>🎒 Items</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Stats footer */}
        <View style={styles.statsSection}>
          <ThemedText style={styles.statText}>Rounds Won: {hiveState.roundsWon}</ThemedText>
          <ThemedText style={styles.statText}>Caught: {hiveState.bugsCaught.length}</ThemedText>
          <ThemedText style={styles.statText}>Items: {hiveState.itemsGained.length}</ThemedText>
        </View>

        {/* Exit Run */}
        <TouchableOpacity
          style={styles.endRunButton}
          onPress={handleAbandonRun}
          disabled={isProcessingTurn}
        >
          <ThemedText style={styles.endRunButtonText}>🚪 Exit Run</ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {renderItemSelector()}
      {renderSwitchSelector()}
      {renderNicknameModal()}
      {renderRunSummary()}
    </SafeAreaView>
  );
}

// ════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════
const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      paddingHorizontal: 16,
      paddingBottom: 14,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 3,
      borderBottomColor: theme.colors.warning,
    },
    backButton: {
      width: 36, height: 36, borderRadius: 6,
      backgroundColor: theme.colors.surface,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: theme.colors.border,
    },
    backButtonText: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
    headerTitle: {
      flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900',
      color: theme.colors.text, letterSpacing: 1, textTransform: 'uppercase',
    },
    headerSpacer: { width: 36 },
    scrollContainer: { padding: 16, paddingBottom: 40 },
    welcomeSection: { alignItems: 'center', marginBottom: 24 },
    welcomeTitle: { fontSize: 24, fontWeight: '900', marginTop: 14, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' },
    welcomeDescription: { fontSize: 14, textAlign: 'center', color: theme.colors.textSecondary },
    rulesSection: {
      backgroundColor: theme.colors.card, borderRadius: 10, padding: 16, marginBottom: 20,
      borderWidth: 2, borderColor: theme.colors.border,
    },
    rulesTitle: { fontSize: 15, fontWeight: '900', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    ruleText: { fontSize: 13, marginBottom: 6, color: theme.colors.textSecondary, fontWeight: '600' },
    startButton: {
      flexDirection: 'row', backgroundColor: theme.colors.warning, borderRadius: 8, padding: 18,
      alignItems: 'center', justifyContent: 'center', gap: 10,
      borderWidth: 3, borderColor: `${theme.colors.warning}80`,
    },
    startButtonText: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 1, textTransform: 'uppercase' },
    battleContainer: { padding: 16, paddingBottom: 40 },
    enemySection: {
      alignItems: 'center', marginBottom: 16, padding: 14,
      backgroundColor: theme.colors.card, borderRadius: 10,
      borderWidth: 2, borderColor: theme.colors.error, borderLeftWidth: 5,
    },
    playerSection: {
      alignItems: 'center', marginBottom: 16, padding: 14,
      backgroundColor: theme.colors.card, borderRadius: 10,
      borderWidth: 2, borderColor: theme.colors.primary, borderLeftWidth: 5,
    },
    bugName: { fontSize: 16, fontWeight: '900', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
    hpBar: {
      width: '100%', height: 18, backgroundColor: theme.colors.surface,
      borderRadius: 4, overflow: 'hidden', marginBottom: 3,
      borderWidth: 2, borderColor: theme.colors.border,
    },
    hpBarFill: { height: '100%', borderRadius: 2 },
    hpText: { fontSize: 12, fontWeight: '800', marginBottom: 10, color: theme.colors.textSecondary },
    bugSprite: { alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    enemySprite: { fontSize: 56 },
    enemyBugImage: { width: 72, height: 72, borderRadius: 8, borderWidth: 2, borderColor: theme.colors.border },
    playerSprite: { fontSize: 42 },
    playerBugImage: { width: 58, height: 58, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border },
    messageBox: {
      backgroundColor: theme.colors.warning, borderRadius: 8, padding: 14, marginBottom: 16,
      minHeight: 52, justifyContent: 'center', borderWidth: 2, borderColor: `${theme.colors.warning}80`,
    },
    messageText: { fontSize: 14, fontWeight: '800', textAlign: 'center', color: '#FFF', letterSpacing: 0.3 },
    actionButtons: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    actionButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
    attackButton: { backgroundColor: theme.colors.error, borderColor: `${theme.colors.error}80` },
    switchButton: { backgroundColor: theme.colors.warning, borderColor: `${theme.colors.warning}80` },
    itemButton: { backgroundColor: theme.colors.primary, borderColor: `${theme.colors.primary}80` },
    actionButtonText: { fontSize: 13, fontWeight: '900', color: '#FFF', textTransform: 'uppercase', letterSpacing: 0.5 },
    statsSection: {
      flexDirection: 'row', justifyContent: 'space-around',
      backgroundColor: theme.colors.card, borderRadius: 8, padding: 14,
      borderWidth: 2, borderColor: theme.colors.border,
    },
    statText: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
    // ── Modals ──
    modalContainer: { flex: 1, backgroundColor: theme.colors.background },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 16,
      paddingBottom: 16, borderBottomWidth: 3, borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    modalTitle: { flex: 1, fontSize: 18, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
    closeButton: {
      width: 34, height: 34, borderRadius: 6,
      backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: theme.colors.border,
    },
    closeButtonText: { fontSize: 14, fontWeight: '900', color: theme.colors.text },
    bugList: { flex: 1, padding: 16 },
    bugListItem: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: theme.colors.card, borderRadius: 8, padding: 12, marginBottom: 8,
      borderWidth: 2, borderColor: theme.colors.border,
    },
    bugListPhoto: {
      width: 46, height: 46, borderRadius: 6, marginRight: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.border,
    },
    bugListInfo: { flex: 1 },
    bugListName: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
    bugListDetails: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted },
    sectionLabel: { fontSize: 14, fontWeight: '900', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    itemModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    itemModalContent: {
      width: screenWidth - 64, backgroundColor: theme.colors.card, borderRadius: 10, padding: 16,
      borderWidth: 3, borderColor: theme.colors.border,
    },
    itemModalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 14, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
    noItemsText: { fontSize: 14, textAlign: 'center', color: theme.colors.textMuted, marginBottom: 14, fontWeight: '600' },
    itemSlotButton: {
      flexDirection: 'row', alignItems: 'center', padding: 12,
      backgroundColor: theme.colors.surface, borderRadius: 8, marginBottom: 8,
      borderWidth: 2, borderColor: theme.colors.border,
    },
    itemEmoji: { fontSize: 22, marginRight: 10 },
    itemInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemName: { fontSize: 14, fontWeight: '800' },
    itemQuantity: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },
    cancelButton: { padding: 14, alignItems: 'center', borderTopWidth: 2, borderTopColor: theme.colors.border, marginTop: 6 },
    cancelButtonText: { fontSize: 14, fontWeight: '800', color: theme.colors.error, textTransform: 'uppercase', letterSpacing: 0.5 },
    switchModalContent: {
      width: screenWidth - 48, backgroundColor: theme.colors.card, borderRadius: 10, padding: 16,
      maxHeight: '70%', borderWidth: 3, borderColor: theme.colors.border,
    },
    switchSubtitle: { fontSize: 12, textAlign: 'center', color: theme.colors.textMuted, marginBottom: 14, fontWeight: '600' },
    switchBugItem: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: theme.colors.surface, borderRadius: 8, padding: 12, marginBottom: 8,
      borderWidth: 2, borderColor: theme.colors.border,
    },
    switchBugPhoto: {
      width: 40, height: 40, borderRadius: 6, marginRight: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.card, borderWidth: 2, borderColor: theme.colors.border,
    },
    switchBugInfo: { flex: 1 },
    switchBugName: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
    switchBugHpRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    switchBugLevel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, width: 36 },
    switchBugHpBar: {
      flex: 1, height: 7, backgroundColor: theme.colors.surface,
      borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border,
    },
    switchBugHpFill: { height: '100%', borderRadius: 3 },
    switchBugHpText: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted, width: 56, textAlign: 'right' },
    endRunButton: {
      padding: 14, backgroundColor: theme.colors.error, borderRadius: 8, alignItems: 'center',
      marginTop: 6, borderWidth: 3, borderColor: `${theme.colors.error}80`,
    },
    endRunButtonText: { fontSize: 14, fontWeight: '900', color: '#FFF', textTransform: 'uppercase', letterSpacing: 0.5 },
    // ── Summary ──
    summaryRow: {
      flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
      borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    summaryLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    summaryValue: { fontSize: 14, fontWeight: '900', color: theme.colors.text },
    summarySection: { fontSize: 13, fontWeight: '900', marginTop: 14, marginBottom: 4, textTransform: 'uppercase', color: theme.colors.primary },
    summaryEmpty: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 4, fontStyle: 'italic' },
    summaryListItem: { fontSize: 13, fontWeight: '600', marginBottom: 3, color: theme.colors.text },
  });
