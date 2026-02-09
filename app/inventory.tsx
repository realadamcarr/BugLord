/**
 * Inventory Screen
 * 
 * UI for viewing and using inventory items.
 * Features:
 * - Display all owned items with quantities
 * - Use heal/revive items on bugs from party & collection
 * - Show item details
 */

import { ThemedText } from '@/components/ThemedText';
import { getItemDefinition } from '@/constants/Items';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Bug } from '@/types/Bug';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InventoryScreen() {
  const { theme } = useTheme();
  const {
    inventory,
    loading,
    addItem,
    removeItem,
    useItem,
    getItemQuantity,
    clearInventory,
  } = useInventory();
  const { collection, updateBugHp } = useBugCollection();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showBugPicker, setShowBugPicker] = useState(false);

  const styles = createStyles(theme);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const selectedItem = selectedItemId ? getItemDefinition(selectedItemId) : null;

  // Get all bugs (party first, then collection minus party dupes)
  const allBugs: Bug[] = [
    ...collection.party.filter((bug): bug is Bug => bug !== null),
    ...collection.bugs.filter(bug => !collection.party.some(p => p?.id === bug.id)),
  ];

  // Filter bugs based on selected item type
  const getTargetBugs = (): Bug[] => {
    if (!selectedItem) return [];

    if (selectedItem.type === 'revive') {
      // Only show fainted bugs (HP === 0)
      return allBugs.filter(bug => {
        const maxHp = bug.maxHp || bug.maxXp;
        const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
        return currentHp <= 0;
      });
    }

    if (selectedItem.type === 'heal') {
      // Only show alive bugs that are not at full HP
      return allBugs.filter(bug => {
        const maxHp = bug.maxHp || bug.maxXp;
        const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
        return currentHp > 0 && currentHp < maxHp;
      });
    }

    return [];
  };

  const handleUseItem = async (targetBug: Bug) => {
    if (!selectedItem) return;

    const result = await useItem(selectedItem.id, targetBug);

    if (result.success) {
      const maxHp = targetBug.maxHp || targetBug.maxXp;
      let newHp = targetBug.currentHp !== undefined ? targetBug.currentHp : maxHp;

      if (selectedItem.type === 'heal' && selectedItem.effect.healAmount) {
        newHp = Math.min(maxHp, newHp + selectedItem.effect.healAmount);
      } else if (selectedItem.type === 'revive' && selectedItem.effect.reviveHpPercent) {
        newHp = Math.floor(maxHp * selectedItem.effect.reviveHpPercent);
      }

      await updateBugHp(targetBug.id, newHp);

      setShowBugPicker(false);
      Alert.alert(
        'Item Used!',
        `${selectedItem.name} used on ${targetBug.nickname || targetBug.name}.\nHP: ${newHp}/${maxHp}`,
      );
    } else {
      Alert.alert('Cannot Use', result.message);
    }
  };

  const handleUseButtonPress = () => {
    if (!selectedItem) return;

    if (selectedItem.type === 'trap') {
      Alert.alert('Battle Item', 'Bug Traps can only be used during Hive Mode battles.');
      return;
    }

    const targets = getTargetBugs();
    if (targets.length === 0) {
      if (selectedItem.type === 'revive') {
        Alert.alert('No Fainted Bugs', 'None of your bugs need reviving!');
      } else {
        Alert.alert('No Injured Bugs', 'All your bugs are at full HP!');
      }
      return;
    }

    setShowBugPicker(true);
  };

  const renderBugPicker = () => {
    const targets = getTargetBugs();

    return (
      <Modal visible={showBugPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>
              {selectedItem?.type === 'revive' ? 'Revive Which Bug?' : 'Heal Which Bug?'}
            </ThemedText>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowBugPicker(false)}>
              <Text style={[styles.closeButtonText, { color: theme.colors.text }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bugList}>
            {targets.map(bug => {
              const maxHp = bug.maxHp || bug.maxXp;
              const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
              const hpPercent = maxHp > 0 ? currentHp / maxHp : 0;
              const isFainted = currentHp <= 0;

              return (
                <TouchableOpacity
                  key={bug.id}
                  style={[styles.bugPickerItem, { backgroundColor: theme.colors.surface || theme.colors.card }]}
                  onPress={() => handleUseItem(bug)}
                >
                  {bug.photo ? (
                    <Image source={{ uri: bug.photo }} style={[styles.bugPickerPhoto, isFainted && styles.faintedPhoto]} />
                  ) : bug.pixelArt ? (
                    <Image source={{ uri: bug.pixelArt }} style={[styles.bugPickerPhoto, isFainted && styles.faintedPhoto]} />
                  ) : (
                    <View style={[styles.bugPickerPhoto, { backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 20 }}>🐛</Text>
                    </View>
                  )}
                  <View style={styles.bugPickerInfo}>
                    <ThemedText style={styles.bugPickerName}>
                      {bug.nickname || bug.name}
                      {isFainted ? ' 💀' : ''}
                    </ThemedText>
                    <ThemedText style={styles.bugPickerLevel}>Level {bug.level}</ThemedText>
                    {/* HP Bar */}
                    <View style={styles.hpBarContainer}>
                      <View style={styles.hpBarTrack}>
                        <View style={[
                          styles.hpBarFill,
                          {
                            width: `${Math.max(hpPercent * 100, 0)}%`,
                            backgroundColor: isFainted ? '#666' : hpPercent > 0.5 ? '#51CF66' : hpPercent > 0.25 ? '#FCC419' : '#FF6B6B',
                          },
                        ]} />
                      </View>
                      <ThemedText style={styles.hpBarText}>
                        {currentHp}/{maxHp} HP
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <ThemedText style={styles.title}>📦 Inventory</ThemedText>

      <ScrollView style={styles.content}>
        {/* Inventory Grid */}
        {inventory.length === 0 ? (
          <ThemedText style={styles.emptyText}>No items in inventory</ThemedText>
        ) : (
          <View style={styles.itemGrid}>
            {inventory.map(slot => {
              const itemDef = getItemDefinition(slot.itemId);
              if (!itemDef) return null;

              const isSelected = selectedItemId === slot.itemId;

              return (
                <TouchableOpacity
                  key={slot.itemId}
                  style={[
                    styles.itemCard,
                    isSelected && styles.itemCardSelected,
                  ]}
                  onPress={() => setSelectedItemId(slot.itemId)}
                >
                  {/* Type badge */}
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          itemDef.type === 'trap'
                            ? '#FF6B6B'
                            : itemDef.type === 'heal'
                            ? '#51CF66'
                            : '#4ECDC4',
                      },
                    ]}
                  >
                    <ThemedText style={styles.typeLabel}>
                      {itemDef.type.toUpperCase()}
                    </ThemedText>
                  </View>

                  {/* Item name */}
                  <ThemedText style={styles.itemName}>{itemDef.name}</ThemedText>

                  {/* Quantity */}
                  <ThemedText style={styles.itemQuantity}>
                    × {slot.quantity}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Selected Item Details */}
        {selectedItem && (
          <View style={styles.detailsPanel}>
            <ThemedText style={styles.detailsTitle}>{selectedItem.name}</ThemedText>

            <ThemedText style={styles.detailsDescription}>
              {selectedItem.description}
            </ThemedText>

            {/* Effect details */}
            <View style={styles.effectsContainer}>
              <ThemedText style={styles.effectsLabel}>Effects:</ThemedText>
              {selectedItem.type === 'trap' && (
                <ThemedText style={styles.effectText}>
                  +{Math.round((selectedItem.effect.trapSuccessRate || 0) * 100)}% catch rate
                </ThemedText>
              )}
              {selectedItem.type === 'heal' && (
                <ThemedText style={styles.effectText}>
                  Restores {selectedItem.effect.healAmount} HP
                </ThemedText>
              )}
              {selectedItem.type === 'revive' && (
                <ThemedText style={styles.effectText}>
                  Revives with {Math.round((selectedItem.effect.reviveHpPercent || 0) * 100)}% HP
                </ThemedText>
              )}
            </View>

            {/* Stack info */}
            <ThemedText style={styles.stackInfo}>
              Owned: {getItemQuantity(selectedItem.id)} / {selectedItem.stackLimit || 99}
            </ThemedText>

            {/* Action buttons */}
            <View style={styles.actions}>
              {(selectedItem.type === 'heal' || selectedItem.type === 'revive') && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.useButton]}
                  onPress={handleUseButtonPress}
                  disabled={getItemQuantity(selectedItem.id) <= 0}
                >
                  <ThemedText style={styles.actionButtonText}>
                    {selectedItem.type === 'revive' ? '💊 Revive Bug' : '💚 Heal Bug'}
                  </ThemedText>
                </TouchableOpacity>
              )}
              {selectedItem.type === 'trap' && (
                <View style={[styles.actionButton, styles.trapInfoButton]}>
                  <ThemedText style={styles.actionButtonText}>⚔️ Use in Hive Mode</ThemedText>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.debugFooter}>
        <ThemedText style={styles.itemCount}>
          {inventory.reduce((sum, slot) => sum + slot.quantity, 0)} items total
        </ThemedText>
      </View>

      {renderBugPicker()}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 16,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    content: {
      flex: 1,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 40,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    itemGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    },
    itemCard: {
      width: '48%',
      padding: 12,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    itemCardSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 3,
      backgroundColor: `${theme.colors.primary}12`,
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      marginBottom: 8,
      alignSelf: 'flex-start',
    },
    typeLabel: {
      fontSize: 9,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 0.5,
    },
    itemName: {
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 3,
    },
    itemQuantity: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textMuted,
    },
    detailsPanel: {
      marginTop: 16,
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 2,
      borderColor: theme.colors.border,
      borderLeftWidth: 5,
      borderLeftColor: theme.colors.primary,
    },
    detailsTitle: {
      fontSize: 16,
      fontWeight: '900',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    detailsDescription: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 10,
    },
    effectsContainer: {
      marginBottom: 10,
      padding: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    effectsLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.colors.textMuted,
      marginBottom: 3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    effectText: {
      fontSize: 12,
      marginLeft: 8,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    stackInfo: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginBottom: 10,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 3,
    },
    useButton: {
      backgroundColor: theme.colors.success,
      borderColor: `${theme.colors.success}80`,
    },
    trapInfoButton: {
      backgroundColor: theme.colors.textMuted,
      borderColor: theme.colors.border,
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: '900',
      color: '#fff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    debugFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 10,
      borderTopWidth: 2,
      borderTopColor: theme.colors.border,
      marginTop: 12,
    },
    itemCount: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    // Bug picker modal
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 60,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 3,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    modalTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 6,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    closeButtonText: {
      fontSize: 14,
      fontWeight: '900',
    },
    bugList: {
      flex: 1,
      padding: 16,
    },
    bugPickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    bugPickerPhoto: {
      width: 46,
      height: 46,
      borderRadius: 6,
      marginRight: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    faintedPhoto: {
      opacity: 0.4,
    },
    bugPickerInfo: {
      flex: 1,
    },
    bugPickerName: {
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 2,
    },
    bugPickerLevel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textMuted,
      marginBottom: 5,
    },
    hpBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    hpBarTrack: {
      flex: 1,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.xpBackground,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    hpBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    hpBarText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.textMuted,
      minWidth: 56,
    },
  });
