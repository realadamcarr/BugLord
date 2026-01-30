/**
 * Inventory Screen
 * 
 * Simple MVP UI for viewing and managing inventory.
 * No fancy animations - just functional item display and usage.
 * 
 * Features:
 * - Display all owned items with quantities
 * - Add/remove items (debug buttons)
 * - Show item details
 */

import { ThemedText } from '@/components/ThemedText';
import { getItemDefinition } from '@/constants/Items';
import { useInventory } from '@/contexts/InventoryContext';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
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
    getItemQuantity,
    clearInventory,
  } = useInventory();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const styles = createStyles(theme);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const selectedItem = selectedItemId ? getItemDefinition(selectedItemId) : null;

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
              <TouchableOpacity
                style={[styles.actionButton, styles.addButton]}
                onPress={() => addItem(selectedItem.id, 1)}
              >
                <ThemedText style={styles.actionButtonText}>+ Add 1</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.removeButton]}
                onPress={() => {
                  if (getItemQuantity(selectedItem.id) > 0) {
                    removeItem(selectedItem.id, 1);
                  }
                }}
              >
                <ThemedText style={styles.actionButtonText}>- Remove 1</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Debug footer */}
      <View style={styles.debugFooter}>
        <TouchableOpacity
          style={[styles.debugButton, { marginRight: 8 }]}
          onPress={() => {
            Alert.alert(
              'Clear Inventory?',
              'Remove all items from inventory?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  onPress: () => clearInventory(),
                  style: 'destructive',
                },
              ]
            );
          }}
        >
          <ThemedText style={styles.debugButtonText}>[DEL] Clear All</ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.itemCount}>
          {inventory.reduce((sum, slot) => sum + slot.quantity, 0)} items
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 20,
    },
    content: {
      flex: 1,
    },
    emptyText: {
      fontSize: 16,
      opacity: 0.6,
      textAlign: 'center',
      marginTop: 40,
    },
    itemGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    itemCard: {
      width: '48%',
      padding: 12,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.colors.border || '#ccc',
      backgroundColor: theme.colors.card || '#f5f5f5',
    },
    itemCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '15',
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginBottom: 8,
      alignSelf: 'flex-start',
    },
    typeLabel: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#fff',
    },
    itemName: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    itemQuantity: {
      fontSize: 12,
      opacity: 0.7,
    },
    detailsPanel: {
      marginTop: 20,
      padding: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.card || '#f5f5f5',
      borderWidth: 1,
      borderColor: theme.colors.border || '#ccc',
    },
    detailsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    detailsDescription: {
      fontSize: 14,
      opacity: 0.8,
      marginBottom: 12,
    },
    effectsContainer: {
      marginBottom: 12,
      padding: 8,
      backgroundColor: theme.colors.background + '80',
      borderRadius: 4,
    },
    effectsLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      opacity: 0.7,
      marginBottom: 4,
    },
    effectText: {
      fontSize: 13,
      marginLeft: 8,
      color: theme.colors.primary,
    },
    stackInfo: {
      fontSize: 12,
      opacity: 0.6,
      marginBottom: 12,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 6,
      alignItems: 'center',
    },
    addButton: {
      backgroundColor: '#51CF66',
    },
    removeButton: {
      backgroundColor: '#FF6B6B',
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#fff',
    },
    debugFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border || '#ccc',
      marginTop: 16,
    },
    debugButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.border || '#ddd',
    },
    debugButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    itemCount: {
      fontSize: 12,
      opacity: 0.6,
    },
  });
