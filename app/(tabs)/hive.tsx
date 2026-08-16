/**
 * Hive Tab Screen
 *
 * Party management, Enter Hive battle mode, and Items.
 */

import { BugInfoModal } from '@/components/BugInfoModal';
import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BUG_SPRITE } from '@/constants/bugSprites';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Bug, ConfirmationMethod, RARITY_CONFIG } from '@/types/Bug';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

export default function HiveScreen() {
  const { theme } = useTheme();
  const { collection, addBugToParty, removeBugFromParty, switchParty, updateBugNickname } = useBugCollection();
  const { getInventorySummary } = useInventory();

  const [showPartyManagement, setShowPartyManagement] = useState(false);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [showBugInfo, setShowBugInfo] = useState(false);

  const styles = createStyles(theme);

  const handleBugTap = (bug: Bug) => {
    setSelectedBug(bug);
    setShowBugInfo(true);
  };

  const handleCloseBugInfo = () => {
    setShowBugInfo(false);
    setSelectedBug(null);
  };

  const handleConfirmBugInfo = ({ nickname }: { nickname?: string; addToParty?: boolean; replaceBugId?: string; confirmedLabel?: string; confirmationMethod?: ConfirmationMethod }) => {
    if (selectedBug && nickname && nickname !== selectedBug.nickname) {
      updateBugNickname(selectedBug.id, nickname);
    }
    handleCloseBugInfo();
  };

  const renderPartyBug = (bug: Bug | null, index: number) => {
    const maxHp = bug ? (bug.maxHp || bug.maxXp) : 0;
    const currentHp = bug ? (bug.currentHp !== undefined ? bug.currentHp : maxHp) : 0;
    const isFainted = bug ? currentHp <= 0 : false;
    const hpPercent = maxHp > 0 ? currentHp / maxHp : 1;

    return (
      <TouchableOpacity
        key={index}
        style={[styles.partySlot, !bug && styles.emptyPartySlot]}
        onPress={() => bug && handleBugTap(bug)}
        activeOpacity={bug ? 0.7 : 1}
        disabled={!bug}
      >
        {bug ? (
          <View style={[styles.bugInSlot, isFainted && { opacity: 0.5 }]}>
            {bug.category && BUG_SPRITE[bug.category] ? (
              <Image source={BUG_SPRITE[bug.category]} style={styles.bugPhoto} />
            ) : bug.photo ? (
              <Image source={{ uri: bug.photo }} style={styles.bugPhoto} />
            ) : bug.pixelArt ? (
              <Image source={{ uri: bug.pixelArt }} style={styles.bugPhoto} />
            ) : (
              <PixelatedEmoji type="bug" size={32} color={theme.colors.text} />
            )}
            {isFainted && <Text style={{ fontSize: 12, color: '#FF6B6B', fontWeight: '700', marginTop: 2 }}>💀 FAINTED</Text>}
            <ThemedText style={styles.bugName} numberOfLines={1}>{bug.nickname || bug.name}</ThemedText>
            <Text style={[styles.rarityBadge, { backgroundColor: RARITY_CONFIG[bug.rarity]?.color || '#666' }]}>
              Lv.{bug.level}
            </Text>
            <View style={styles.bugXpContainer}>
              <View style={styles.bugXpBar}>
                <View style={[styles.bugXpFill, { width: `${Math.max(hpPercent * 100, 0)}%`, backgroundColor: isFainted ? '#666' : hpPercent > 0.5 ? '#51CF66' : hpPercent > 0.25 ? '#FCC419' : '#FF6B6B' }]} />
              </View>
              <ThemedText style={styles.bugXpText}>{currentHp}/{maxHp} HP</ThemedText>
            </View>
          </View>
        ) : (
          <View style={styles.emptySlotContent}>
            <Text style={styles.emptySlotText}>+</Text>
            <ThemedText style={styles.emptySlotLabel}>Empty</ThemedText>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const inventorySummary = getInventorySummary();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View className="items-center mb-4">
          <ThemedText style={styles.headerTitle}>Hive Mode</ThemedText>
        </View>

        {/* Enter Hive Button */}
        <View style={styles.heroSection}>
          <TouchableOpacity
            style={styles.enterHiveButton}
            onPress={() => router.push('/hivemode')}
            activeOpacity={0.8}
          >
            <View style={styles.heroIconContainer}>
              <Text style={styles.heroIcon}>🐝</Text>
            </View>
            <ThemedText style={styles.enterHiveTitle}>Enter The Hive</ThemedText>
            <ThemedText style={styles.enterHiveSubtitle}>Battle 10 rounds of bugs</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Party Display */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Your Party</ThemedText>
            <Text style={styles.partyBadge}>Loadout {collection.activePartyIndex + 1}</Text>
          </View>
          <View style={styles.partyGrid}>
            {collection.party.map((bug, index) => renderPartyBug(bug, index))}
          </View>
          <TouchableOpacity style={styles.managePartyButton} onPress={() => setShowPartyManagement(true)}>
            <ThemedText style={styles.managePartyButtonText}>Manage Party</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Items</ThemedText>
          <TouchableOpacity style={styles.itemsCard} onPress={() => router.push('/inventory')} activeOpacity={0.8}>
            <Text style={styles.itemsIcon}>🎒</Text>
            <View style={styles.itemsCardContent}>
              <ThemedText style={styles.itemsCardTitle}>View Inventory</ThemedText>
              <ThemedText style={styles.itemsCardSubtitle}>
                {inventorySummary.length > 0
                  ? `${inventorySummary.length} item type${inventorySummary.length === 1 ? '' : 's'} available`
                  : 'No items — find some while walking!'}
              </ThemedText>
            </View>
            <Text style={styles.arrowIcon}>→</Text>
          </TouchableOpacity>

          {inventorySummary.length > 0 && (
            <View style={styles.itemPreviewRow}>
              {inventorySummary.slice(0, 4).map((item: any) => (
                <TouchableOpacity
                  key={item.itemId ?? item.id}
                  style={styles.itemPreviewCard}
                  onPress={() => router.push('/inventory')}
                >
                  <Text style={styles.itemPreviewIcon}>{item.icon || '📦'}</Text>
                  <ThemedText style={styles.itemPreviewName} numberOfLines={1}>{item.name || item.itemId}</ThemedText>
                  <ThemedText style={styles.itemPreviewCount}>×{item.count ?? item.quantity ?? 0}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Party Management Modal */}
      <Modal visible={showPartyManagement} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPartyManagement(false)} style={styles.closeButton}>
              <ThemedText style={styles.closeButtonText}>✕</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>Manage Party</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          {/* Loadout Tabs */}
          <View style={styles.partyTabsContainer}>
            {['Party 1', 'Party 2', 'Party 3'].map((label, idx) => {
              const isActive = collection.activePartyIndex === idx;
              const bugCount = collection.parties[idx]?.filter(Boolean).length ?? 0;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.partyTab, isActive && styles.partyTabActive]}
                  onPress={() => switchParty(idx)}
                >
                  <Text style={[styles.partyTabText, isActive && styles.partyTabTextActive]}>{label}</Text>
                  <Text style={[styles.partyTabCount, isActive && styles.partyTabCountActive]}>{bugCount}/6</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={styles.modalScroll}>
            {/* Current Party */}
            <View style={styles.modalSection}>
              <ThemedText style={styles.modalSectionTitle}>Current Party (Tap to Remove)</ThemedText>
              <View style={styles.modalGrid}>
                {collection.party.map((bug, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.modalSlot, !bug && styles.modalEmptySlot]}
                    onPress={() => { if (bug) removeBugFromParty(index); }}
                  >
                    {bug ? (
                      <>
                        {bug.category && BUG_SPRITE[bug.category] ? (
                          <Image source={BUG_SPRITE[bug.category]} style={styles.modalBugPhoto} />
                        ) : bug.photo ? (
                          <Image source={{ uri: bug.photo }} style={styles.modalBugPhoto} />
                        ) : bug.pixelArt ? (
                          <Image source={{ uri: bug.pixelArt }} style={styles.modalBugPhoto} />
                        ) : (
                          <PixelatedEmoji type="bug" size={40} color={theme.colors.text} />
                        )}
                        <ThemedText style={styles.modalBugName} numberOfLines={1}>{bug.nickname || bug.name}</ThemedText>
                        <ThemedText style={styles.modalBugLevel}>Lv.{bug.level}</ThemedText>
                        <ThemedText style={styles.modalBugHp}>HP {bug.currentHp ?? bug.maxHp ?? bug.maxXp}/{bug.maxHp ?? bug.maxXp}</ThemedText>
                        <Text style={[styles.modalRarityBadge, { backgroundColor: RARITY_CONFIG[bug.rarity]?.color || '#666' }]}>{bug.rarity}</Text>
                      </>
                    ) : (
                      <ThemedText style={styles.modalEmptyText}>Empty Slot</ThemedText>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Available Bugs */}
            <View style={styles.modalSection}>
              <ThemedText style={styles.modalSectionTitle}>Available Bugs (Tap to Add)</ThemedText>
              <View style={styles.modalGrid}>
                {collection.bugs
                  .filter(bug => !collection.party.some(partyBug => partyBug?.id === bug.id))
                  .map((bug) => (
                    <TouchableOpacity
                      key={bug.id}
                      style={styles.modalSlot}
                      onPress={() => {
                        const hasSpace = collection.party.some(slot => slot === null);
                        if (hasSpace) {
                          addBugToParty(bug);
                        } else {
                          Alert.alert('Party Full', 'Your party is full! Remove a bug from your party first.', [{ text: 'OK' }]);
                        }
                      }}
                    >
                      {bug.category && BUG_SPRITE[bug.category] ? (
                        <Image source={BUG_SPRITE[bug.category]} style={styles.modalBugPhoto} />
                      ) : bug.photo ? (
                        <Image source={{ uri: bug.photo }} style={styles.modalBugPhoto} />
                      ) : bug.pixelArt ? (
                        <Image source={{ uri: bug.pixelArt }} style={styles.modalBugPhoto} />
                      ) : (
                        <PixelatedEmoji type="bug" size={40} color={theme.colors.text} />
                      )}
                      <ThemedText style={styles.modalBugName} numberOfLines={1}>{bug.nickname || bug.name}</ThemedText>
                      <ThemedText style={styles.modalBugLevel}>Lv.{bug.level}</ThemedText>
                      <ThemedText style={styles.modalBugHp}>HP {bug.currentHp ?? bug.maxHp ?? bug.maxXp}/{bug.maxHp ?? bug.maxXp}</ThemedText>
                      <Text style={[styles.modalRarityBadge, { backgroundColor: RARITY_CONFIG[bug.rarity]?.color || '#666' }]}>{bug.rarity}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
              {collection.bugs.filter(bug => !collection.party.some(partyBug => partyBug?.id === bug.id)).length === 0 && (
                <ThemedText style={styles.allInPartyText}>All bugs are in your party!</ThemedText>
              )}
            </View>
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* Bug Info Modal */}
      <BugInfoModal
        visible={showBugInfo}
        bug={selectedBug}
        onClose={handleCloseBugInfo}
        onConfirm={handleConfirmBugInfo}
        isNewCatch={false}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContainer: { paddingBottom: 100 },
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroSection: { padding: 16 },
  enterHiveButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    padding: 22,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.border,
    borderLeftWidth: 5,
    borderLeftColor: theme.colors.warning,
    minHeight: 150,
  },
  heroIconContainer: { marginBottom: 10 },
  heroIcon: { fontSize: 56 },
  enterHiveTitle: { fontSize: 24, fontWeight: '900', marginBottom: 6, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' },
  enterHiveSubtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  section: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  partyBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  partyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  partySlot: {
    width: (screenWidth - 52) / 3,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 10,
    minHeight: 115,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  emptyPartySlot: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: theme.colors.separator,
    justifyContent: 'center',
  },
  bugInSlot: { alignItems: 'center' },
  bugPhoto: { width: 46, height: 46, borderRadius: 6, marginBottom: 5, borderWidth: 2, borderColor: theme.colors.border },
  bugName: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 3 },
  rarityBadge: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 5, overflow: 'hidden' },
  bugXpContainer: { width: '100%', alignItems: 'center' },
  bugXpBar: { width: '100%', height: 5, backgroundColor: theme.colors.xpBackground, borderRadius: 3, marginBottom: 2, borderWidth: 1, borderColor: theme.colors.border },
  bugXpFill: { height: '100%', borderRadius: 2 },
  bugXpText: { fontSize: 8, fontWeight: '700', color: theme.colors.textMuted },
  emptySlotContent: { alignItems: 'center' },
  emptySlotText: { fontSize: 22, color: theme.colors.textMuted, fontWeight: '900', marginBottom: 2 },
  emptySlotLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.textMuted },
  managePartyButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  managePartyButtonText: { fontSize: 12, fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderLeftWidth: 5,
    borderLeftColor: theme.colors.primary,
    marginBottom: 12,
  },
  itemsIcon: { fontSize: 28, marginRight: 14 },
  itemsCardContent: { flex: 1 },
  itemsCardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  itemsCardSubtitle: { fontSize: 12, color: theme.colors.textMuted },
  arrowIcon: { fontSize: 18, color: theme.colors.primary, fontWeight: '900' },
  itemPreviewRow: { flexDirection: 'row', gap: 10 },
  itemPreviewCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  itemPreviewIcon: { fontSize: 28, marginBottom: 4 },
  itemPreviewName: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 2, color: theme.colors.textSecondary },
  itemPreviewCount: { fontSize: 14, fontWeight: '900', color: theme.colors.primary },
  // Modal
  modalContainer: { flex: 1 },
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  closeButtonText: { fontSize: 16, fontWeight: '900' },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  partyTabsContainer: { flexDirection: 'row', backgroundColor: theme.colors.card, borderBottomWidth: 2, borderBottomColor: theme.colors.border },
  partyTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  partyTabActive: { borderBottomColor: theme.colors.primary },
  partyTabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted },
  partyTabTextActive: { color: theme.colors.primary },
  partyTabCount: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted, marginTop: 2 },
  partyTabCountActive: { color: theme.colors.primary },
  modalScroll: { flex: 1 },
  modalSection: { padding: 16 },
  modalSectionTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modalSlot: {
    width: (screenWidth - 52) / 3,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 10,
    minHeight: 130,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  modalEmptySlot: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: theme.colors.separator, justifyContent: 'center' },
  modalBugPhoto: { width: 46, height: 46, borderRadius: 6, marginBottom: 5, borderWidth: 2, borderColor: theme.colors.border },
  modalBugName: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  modalBugLevel: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted },
  modalBugHp: { fontSize: 9, fontWeight: '600', color: theme.colors.textMuted, marginTop: 1 },
  modalRarityBadge: { fontSize: 8, fontWeight: '800', color: '#FFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, overflow: 'hidden' },
  modalEmptyText: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center' },
  allInPartyText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 12, fontWeight: '600' },
});
