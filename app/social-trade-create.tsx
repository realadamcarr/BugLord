import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { BugInstance } from '@/src/models/bugs';
import { listMyBugs } from '@/src/services/inventoryService';
import { createTrade } from '@/src/services/tradeService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
  const params = useLocalSearchParams<{ friendUid: string; friendName: string }>();
  const friendUid = params.friendUid;
  const friendName = params.friendName ?? 'Friend';

  const [myBugs, setMyBugs] = useState<BugInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBug, setSelectedBug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = listMyBugs(
      user.uid,
      (bugs) => {
        // Filter out bugs already locked in a trade
        setMyBugs(bugs.filter((b) => !b.lockedByTradeId));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user]);

  const handleCreateTrade = async () => {
    if (!user || !friendUid || !selectedBug) return;

    setCreating(true);
    try {
      // For now, use the selected bug as both fromBugId and toBugId
      // The recipient will choose their bug in the trade session
      const tradeId = await createTrade(user.uid, friendUid, selectedBug, '');
      Alert.alert('Trade Sent!', `Trade proposal sent to ${friendName}.`);
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
        <ThemedText style={styles.heading}>
          Trade with {friendName}
        </ThemedText>
        <ThemedText style={[styles.subheading, { color: theme.colors.textMuted }]}>
          Select a bug to offer
        </ThemedText>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : myBugs.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            No bugs available for trading.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={myBugs}
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
                    borderWidth: isSelected ? 3 : 2,
                  },
                ]}
                onPress={() => setSelectedBug(isSelected ? null : item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.bugRow}>
                  <View
                    style={[styles.rarityDot, { backgroundColor: rarityColor }]}
                  />
                  <View style={styles.bugInfo}>
                    <ThemedText style={styles.bugName}>
                      {item.nickname ?? item.speciesId}
                    </ThemedText>
                    <ThemedText
                      style={[styles.bugMeta, { color: theme.colors.textMuted }]}
                    >
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

      {/* ── Send button ────────────────────────────────────────── */}
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
            <ThemedText style={styles.sendBtnText}>Send Trade Offer</ThemedText>
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
