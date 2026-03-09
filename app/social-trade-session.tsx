import { ThemedText } from '@/components/ThemedText';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { Trade } from '@/src/models/trades';
import { syncLocalBugToFirestore } from '@/src/services/inventoryService';
import { getUserProfile, UserProfile } from '@/src/services/socialAuth';
import {
    cancelTrade,
    declineTrade,
    setToBugId,
    setTradeAcceptFlag,
    subscribeTrade,
    unsetTradeAcceptFlag,
} from '@/src/services/tradeService';
import { Bug } from '@/types/Bug';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
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

export default function TradeSessionScreen() {
  const { theme } = useTheme();
  const { user } = useAuthUser();
  const router = useRouter();
  const params = useLocalSearchParams<{ tradeId: string }>();
  const tradeId = params.tradeId;

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);

  // Local bugs from BugCollectionContext (AsyncStorage)
  const { collection: bugCollection } = useBugCollection();

  // Recipient bug picker state (only used when toBugId is empty and user is recipient)
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [settingBug, setSettingBug] = useState(false);

  // ── Countdown timer ────────────────────────────────────────────
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Subscribe to trade ─────────────────────────────────────────
  useEffect(() => {
    if (!tradeId) return;
    const unsub = subscribeTrade(
      tradeId,
      (t) => {
        setTrade(t);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [tradeId]);

  // ── Load partner profile ───────────────────────────────────────
  useEffect(() => {
    if (!trade || !user) return;
    const partnerUid =
      trade.fromUid === user.uid ? trade.toUid : trade.fromUid;
    getUserProfile(partnerUid).then(setPartnerProfile);
  }, [trade?.fromUid, trade?.toUid, user?.uid]);

  // ── All local bugs (collection + party), deduplicated ──────────
  const allLocalBugs = useMemo(() => {
    const map = new Map<string, Bug>();
    for (const b of bugCollection.bugs) map.set(b.id, b);
    for (const b of bugCollection.party) {
      if (b) map.set(b.id, b);
    }
    return Array.from(map.values());
  }, [bugCollection.bugs, bugCollection.party]);

  // ── Derived state ──────────────────────────────────────────────
  const isFrom = trade?.fromUid === user?.uid;
  const myAccepted = isFrom ? trade?.fromAccepted : trade?.toAccepted;
  const partnerAccepted = isFrom ? trade?.toAccepted : trade?.fromAccepted;
  const isTerminal = trade
    ? ['completed', 'declined', 'cancelled', 'expired'].includes(trade.status)
    : false;

  // Bug lookup
  const myBugId = isFrom ? trade?.fromBugId : trade?.toBugId;
  const partnerBugId = isFrom ? trade?.toBugId : trade?.fromBugId;
  const myBugData = allLocalBugs.find((b) => b.id === myBugId);
  const needsRecipientPick = !isFrom && !trade?.toBugId;
  const bothBugsSet = !!(trade?.fromBugId && trade?.toBugId);

  // Available bugs for the recipient picker
  const availableBugs = useMemo(() => allLocalBugs, [allLocalBugs]);

  const timeRemaining = useMemo(() => {
    if (!trade?.expiresAt) return '';
    const diff = trade.expiresAt.toMillis() - now;
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [trade, now]);

  const isExpired = trade?.expiresAt ? trade.expiresAt.toMillis() < now : false;

  // ── Handlers ───────────────────────────────────────────────────

  const handleSetBug = useCallback(async () => {
    if (!tradeId || !user || !selectedBugId) return;
    const bug = allLocalBugs.find((b) => b.id === selectedBugId);
    if (!bug) return;

    setSettingBug(true);
    try {
      // Sync local bug to Firestore so the trade system can reference it
      await syncLocalBugToFirestore(user.uid, bug);
      await setToBugId(tradeId, user.uid, selectedBugId);
      setSelectedBugId(null);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to set bug');
    } finally {
      setSettingBug(false);
    }
  }, [tradeId, user, selectedBugId, allLocalBugs]);

  const handleToggleAccept = useCallback(async () => {
    if (!tradeId || !user) return;
    setActionLoading(true);
    try {
      if (myAccepted) {
        await unsetTradeAcceptFlag(tradeId, user.uid);
      } else {
        await setTradeAcceptFlag(tradeId, user.uid);
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }, [tradeId, user, myAccepted]);

  const handleCancel = useCallback(async () => {
    if (!tradeId || !user) return;
    Alert.alert(
      isFrom ? 'Cancel Trade' : 'Decline Trade',
      isFrom
        ? 'Are you sure you want to cancel this trade?'
        : 'Are you sure you want to decline this trade?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: isFrom ? 'Yes, Cancel' : 'Yes, Decline',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              if (isFrom) {
                await cancelTrade(tradeId, user.uid);
              } else {
                await declineTrade(tradeId, user.uid);
              }
              router.back();
            } catch (err: unknown) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed',
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [tradeId, user, isFrom, router]);

  const styles = createStyles(theme);

  // ── Loading ────────────────────────────────────────────────────
  if (loading || !trade) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.colors.textMuted }]}>
            Loading trade…
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  // ── Terminal state ─────────────────────────────────────────────
  if (isTerminal) {
    const statusEmoji: Record<string, string> = {
      completed: '✅',
      declined: '❌',
      cancelled: '🚫',
      expired: '⏰',
    };
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ThemedText style={styles.statusEmoji}>
            {statusEmoji[trade.status] ?? '❓'}
          </ThemedText>
          <ThemedText style={styles.statusTitle}>
            Trade {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
          </ThemedText>
          <TouchableOpacity
            style={[styles.backBtn, { borderColor: theme.colors.border }]}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.backBtnText}>Back to Social</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Bug detail card helper ─────────────────────────────────────
  const renderBugDetail = (bug: Bug | undefined, label: string, emptyLabel: string) => {
    const rarityColor = bug ? (RARITY_COLORS[bug.rarity] ?? '#9CA3AF') : '#9CA3AF';
    return (
      <View style={styles.offerSide}>
        <ThemedText style={[styles.offerLabel, { color: theme.colors.textMuted }]}>
          {label}
        </ThemedText>
        <View style={[styles.offerCard, { backgroundColor: theme.colors.card, borderColor: bug ? rarityColor : theme.colors.border }]}>
          {bug ? (
            <>
              <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
              <ThemedText style={styles.offerName} numberOfLines={1}>
                {bug.nickname ?? bug.name}
              </ThemedText>
              <ThemedText style={[styles.offerMeta, { color: theme.colors.textMuted }]}>
                Lv.{bug.level} • {bug.rarity}
              </ThemedText>
            </>
          ) : (
            <ThemedText style={[styles.offerPending, { color: theme.colors.textMuted }]}>
              {emptyLabel}
            </ThemedText>
          )}
        </View>
      </View>
    );
  };

  // ── RECIPIENT BUG PICKER (toBugId not set yet) ─────────────────
  if (needsRecipientPick) {
    const pickerBugData = availableBugs.find((b) => b.id === selectedBugId);
    return (
      <SafeAreaView style={styles.container}>
        {/* Timer */}
        <View style={[styles.timerBar, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={[styles.timerLabel, { color: theme.colors.textMuted }]}>
            Time Remaining
          </ThemedText>
          <ThemedText style={[styles.timerValue, { color: isExpired ? '#EF4444' : theme.colors.text }]}>
            {timeRemaining}
          </ThemedText>
        </View>

        <View style={styles.pickerHeader}>
          <ThemedText style={styles.heading}>
            {partnerProfile?.displayName ?? 'Someone'} wants to trade!
          </ThemedText>
          <ThemedText style={[styles.subheading, { color: theme.colors.textMuted }]}>
            Choose a bug from your collection to offer back
          </ThemedText>
        </View>

        {/* Show partner's offer */}
        <View style={[styles.partnerOfferBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}>
          <ThemedText style={[styles.offerLabel, { color: theme.colors.textMuted }]}>
            THEIR OFFER
          </ThemedText>
          {/* We can't show full details of partner's bug since we don't have their inventory —
              but we do know the fromBugId. We'll show what we know */}
          <ThemedText style={styles.offerName}>
            🐛 Bug #{trade.fromBugId.slice(0, 8)}
          </ThemedText>
        </View>

        {/* Selected summary */}
        {pickerBugData && (
          <View style={[styles.partnerOfferBanner, { backgroundColor: theme.colors.card, borderColor: '#22C55E' }]}>
            <ThemedText style={[styles.offerLabel, { color: theme.colors.textMuted }]}>
              YOUR OFFER
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[pickerBugData.rarity] ?? '#9CA3AF' }]} />
              <ThemedText style={styles.offerName}>
                {pickerBugData.nickname ?? pickerBugData.name}
              </ThemedText>
              <ThemedText style={[styles.offerMeta, { color: theme.colors.textMuted }]}>
                Lv.{pickerBugData.level} • {pickerBugData.rarity}
              </ThemedText>
            </View>
          </View>
        )}

        {/* Bug picker list */}
        {availableBugs.length === 0 ? (
          <View style={styles.center}>
            <ThemedText style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No bugs available for trading
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={availableBugs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = selectedBugId === item.id;
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
                  onPress={() => setSelectedBugId(isSelected ? null : item.id)}
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

        {/* Footer with confirm + decline */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: theme.colors.primary, opacity: !selectedBugId || settingBug ? 0.5 : 1 }]}
            onPress={handleSetBug}
            disabled={!selectedBugId || settingBug}
          >
            {settingBug ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.confirmBtnText}>
                {selectedBugId ? 'Confirm Offer' : 'Select a bug to offer'}
              </ThemedText>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.declineBtn, { borderColor: '#EF4444' }]}
            onPress={handleCancel}
            disabled={actionLoading}
          >
            <ThemedText style={styles.declineBtnText}>Decline Trade</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── MAIN TRADE SESSION (both bugs set) ─────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Timer ──────────────────────────────────────────── */}
        <View style={[styles.timerBar, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={[styles.timerLabel, { color: theme.colors.textMuted }]}>
            Time Remaining
          </ThemedText>
          <ThemedText
            style={[styles.timerValue, { color: isExpired ? '#EF4444' : theme.colors.text }]}
          >
            {timeRemaining}
          </ThemedText>
        </View>

        {/* ── Trade header ──────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={styles.cardTitle}>Trade Session</ThemedText>
          <ThemedText style={[styles.partnerName, { color: theme.colors.textMuted }]}>
            with {partnerProfile?.displayName ?? 'Loading…'}
          </ThemedText>
        </View>

        {/* ── Offers ─────────────────────────────────────────── */}
        <View style={styles.offersRow}>
          {renderBugDetail(
            myBugData,
            'Your Offer',
            'Waiting…',
          )}
          <ThemedText style={[styles.swapIcon, { color: theme.colors.textMuted }]}>⇄</ThemedText>
          {renderBugDetail(
            undefined, // We can't load partner's bug data (blind trade)
            'Their Offer',
            partnerBugId ? `Bug #${partnerBugId.slice(0, 8)}` : 'Waiting…',
          )}
        </View>

        {/* ── Accept status ──────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={styles.cardTitle}>Acceptance</ThemedText>
          <View style={styles.acceptRow}>
            <View style={styles.acceptSide}>
              <ThemedText style={styles.acceptLabel}>You</ThemedText>
              <View
                style={[
                  styles.acceptBadge,
                  {
                    backgroundColor: myAccepted ? '#22C55E20' : '#EF444420',
                    borderColor: myAccepted ? '#22C55E' : '#EF4444',
                  },
                ]}
              >
                <ThemedText
                  style={[styles.acceptText, { color: myAccepted ? '#22C55E' : '#EF4444' }]}
                >
                  {myAccepted ? '✓ Accepted' : '✗ Pending'}
                </ThemedText>
              </View>
            </View>
            <View style={styles.acceptSide}>
              <ThemedText style={styles.acceptLabel}>Partner</ThemedText>
              <View
                style={[
                  styles.acceptBadge,
                  {
                    backgroundColor: partnerAccepted ? '#22C55E20' : '#EF444420',
                    borderColor: partnerAccepted ? '#22C55E' : '#EF4444',
                  },
                ]}
              >
                <ThemedText
                  style={[styles.acceptText, { color: partnerAccepted ? '#22C55E' : '#EF4444' }]}
                >
                  {partnerAccepted ? '✓ Accepted' : '✗ Pending'}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Actions ─────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            {
              backgroundColor: myAccepted ? '#EF4444' : '#22C55E',
              opacity: actionLoading || isExpired || !bothBugsSet ? 0.5 : 1,
            },
          ]}
          onPress={handleToggleAccept}
          disabled={actionLoading || isExpired || !bothBugsSet}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.confirmBtnText}>
              {myAccepted ? 'Revoke Accept' : 'Accept Trade'}
            </ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.declineBtn, { borderColor: '#EF4444' }]}
          onPress={handleCancel}
          disabled={actionLoading}
        >
          <ThemedText style={styles.declineBtnText}>
            {isFrom ? 'Cancel Trade' : 'Decline Trade'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    loadingText: { marginTop: 12, fontSize: 15 },
    content: { flex: 1, padding: 16 },

    // Header & subheading (for picker mode)
    pickerHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    heading: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
    subheading: { fontSize: 14, marginTop: 4 },

    // Timer
    timerBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: 12,
      padding: 14,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 10,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    timerLabel: { fontSize: 14, fontWeight: '600' },
    timerValue: { fontSize: 24, fontWeight: '900', fontFamily: 'SpaceMono', letterSpacing: 2 },

    // Card
    card: {
      borderRadius: 14,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 14,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    partnerName: { fontSize: 14 },

    // Offers row
    offersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 14,
      gap: 8,
    },
    offerSide: { flex: 1, alignItems: 'center' },
    offerLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
    offerCard: {
      width: '100%',
      borderWidth: 2,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      minHeight: 80,
      justifyContent: 'center',
    },
    offerName: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
    offerMeta: { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center' },
    offerPending: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
    rarityDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 4 },
    swapIcon: { fontSize: 24, fontWeight: '900' },

    // Partner offer banner (picker mode)
    partnerOfferBanner: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 12,
      borderWidth: 2,
      padding: 12,
    },

    // Accept status
    acceptRow: { flexDirection: 'row', gap: 12 },
    acceptSide: { flex: 1, alignItems: 'center' },
    acceptLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
    acceptBadge: {
      width: '100%',
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 2,
      alignItems: 'center',
    },
    acceptText: { fontSize: 13, fontWeight: '800' },

    // Bug picker list
    list: { padding: 16, paddingBottom: 160 },
    bugCard: { borderRadius: 12, padding: 14, marginBottom: 10 },
    bugRow: { flexDirection: 'row', alignItems: 'center' },
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
      padding: 16,
      paddingBottom: 24,
      backgroundColor: theme.colors.background,
      borderTopWidth: 2,
      borderTopColor: theme.colors.border,
      gap: 10,
    },
    confirmBtn: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
    },
    confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
    declineBtn: {
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 2,
      alignItems: 'center',
    },
    declineBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },

    // Terminal
    statusEmoji: { fontSize: 56, marginBottom: 16 },
    statusTitle: { fontSize: 24, fontWeight: '900', marginBottom: 24 },
    backBtn: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 2,
    },
    backBtnText: { fontWeight: '700', fontSize: 15 },
  });
}
