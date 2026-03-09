import { ThemedText } from '@/components/ThemedText';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { syncLocalBugToFirestore } from '@/src/services/inventoryService';
import { createTrade } from '@/src/services/tradeService';
import { Bug } from '@/types/Bug';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RARITY_COLORS: Record<string, string> = {
  common: '#9CA3AF',
  uncommon: '#22C55E',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

export default function TradeCreateScreen() {
  const { theme } = useTheme();
  const { user } = useAuthUser();
  const router = useRouter();
  const { collection } = useBugCollection();
  const params = useLocalSearchParams<{ friendUid: string; friendName: string }>();
  const friendUid = params.friendUid;
  const friendName = params.friendName ?? 'Friend';

  const [selectedBug, setSelectedBug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // ── All local bugs (collection + party), deduplicated ──────────
  const allBugs = useMemo(() => {
    const map = new Map<string, Bug>();
    for (const b of collection.bugs) map.set(b.id, b);
    for (const b of collection.party) {
      if (b) map.set(b.id, b);
    }
    return Array.from(map.values());
  }, [collection.bugs, collection.party]);

  const selectedBugData = allBugs.find((b) => b.id === selectedBug);

  const handleCreateTrade = async () => {
    if (!user || !friendUid || !selectedBug) return;
    const bug = allBugs.find((b) => b.id === selectedBug);
    if (!bug) return;

    setCreating(true);
    try {
      // Sync the selected local bug to Firestore so the trade system can
      // reference it (idempotent — won't duplicate if already synced)
      await syncLocalBugToFirestore(user.uid, bug);

      // toBugId is empty — the recipient will choose their bug in the trade session
      const tradeId = await createTrade(user.uid, friendUid, bug.id, '');
      Alert.alert('Trade Sent!', `Trade proposal sent to ${friendName}. They'll choose their bug to offer.`);
      router.replace({
        pathname: '/social-trade-session' as any,
        params: { tradeId },
      });
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to create trade',
      );
    } finally {
      setCreating(false);
    }
  };

  const styles = createStyles(theme);

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <ThemedText>Please sign in first.</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.headerSection}>
        <ThemedText style={styles.heading}>Trade with {friendName}</ThemedText>
        <ThemedText style={[styles.subheading, { color: theme.colors.textMuted }]}>
          Select a bug from your collection to offer
        </ThemedText>
      </View>

      {/* ── Selected summary ─────────────────────────────────── */}
      {selectedBugData && (
        <View style={[styles.selectedBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}>
          <ThemedText style={[styles.selectedLabel, { color: theme.colors.textMuted }]}>
            YOUR OFFER
          </ThemedText>
          <View style={styles.selectedRow}>
            <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[selectedBugData.rarity] ?? '#9CA3AF' }]} />
            <ThemedText style={styles.selectedName}>
              {selectedBugData.nickname ?? selectedBugData.name}
            </ThemedText>
            <ThemedText style={[styles.selectedMeta, { color: theme.colors.textMuted }]}>
              Lv.{selectedBugData.level} • {selectedBugData.rarity}
            </ThemedText>
          </View>
        </View>
      )}

      {/* ── Bug list ─────────────────────────────────────────── */}
      {allBugs.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            No bugs available for trading.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={allBugs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = selectedBug === item.id;
            const rarityColor = RARITY_COLORS[item.rarity] ?? '#9CA3AF';

            return (
              <TouchableOpacity
                style={[
                  styles.bugCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    borderWidth: isSelected ? 3 : 1,
                  },
                ]}
                onPress={() => setSelectedBug(isSelected ? null : item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.bugRow}>
                  <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
                  <View style={styles.bugInfo}>
                    <ThemedText style={styles.bugName}>
                      {item.nickname ?? item.name}
                    </ThemedText>
                    <ThemedText style={[styles.bugMeta, { color: theme.colors.textMuted }]}>
                      Lv.{item.level} • {item.rarity}
                    </ThemedText>
                  </View>
                  {isSelected && (
                    <ThemedText style={[styles.checkmark, { color: theme.colors.primary }]}>
                      ✓
                    </ThemedText>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Send button ──────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: theme.colors.primary,
              opacity: !selectedBug || creating ? 0.5 : 1,
            },
          ]}
          onPress={handleCreateTrade}
          disabled={!selectedBug || creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.sendBtnText}>
              {selectedBug ? 'Send Trade Offer' : 'Select a bug to offer'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    heading: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
    subheading: { fontSize: 14, marginTop: 4 },

    // Selected banner
    selectedBanner: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      borderRadius: 12,
      borderWidth: 2,
      padding: 12,
    },
    selectedLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
    selectedRow: { flexDirection: 'row', alignItems: 'center' },
    selectedName: { fontSize: 16, fontWeight: '800', marginRight: 8 },
    selectedMeta: { fontSize: 12, fontWeight: '600' },

    // Bug list
    list: { padding: 16, paddingBottom: 120 },
    bugCard: {
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    bugRow: { flexDirection: 'row', alignItems: 'center' },
    rarityDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
    bugInfo: { flex: 1 },
    bugName: { fontSize: 16, fontWeight: '700' },
    bugMeta: { fontSize: 12, marginTop: 2 },
    checkmark: { fontSize: 22, fontWeight: '900' },
    emptyText: { fontSize: 15, fontStyle: 'italic', textAlign: 'center' },

    // Footer
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      backgroundColor: theme.colors.background,
      borderTopWidth: 2,
      borderTopColor: theme.colors.border,
    },
    sendBtn: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
    },
    sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  });
}
