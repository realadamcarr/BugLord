import { ThemedText } from '@/components/ThemedText';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { BugInstance } from '@/src/models/bugs';
import { BugSnapshot, Trade } from '@/src/models/trades';
import { getFirestoreBug, syncLocalBugToFirestore } from '@/src/services/inventoryService';
import { getUserProfile, UserProfile } from '@/src/services/socialAuth';
import {
    cancelTrade,
    declineTrade,
    setToBugId,
    setTradeAcceptFlag,
    subscribeTrade,
    unsetTradeAcceptFlag,
} from '@/src/services/tradeService';
import { Bug, generateBugStats, SAMPLE_BUGS } from '@/types/Bug';
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

/** Convert a Firestore BugInstance into local Bug fields for the collection. */
function bugInstanceToLocalBug(inst: BugInstance): Omit<Bug, 'id' | 'caughtAt'> {
  const sample = SAMPLE_BUGS.find(
    b => b.species === inst.speciesId || b.name === inst.speciesId,
  );
  const stats = generateBugStats(inst.rarity);
  const level = inst.level ?? 1;
  const hpForLevel = Math.floor(stats.maxXp * (1 + (level - 1) * 0.2));
  return {
    name: sample?.name ?? inst.speciesId,
    species: inst.speciesId,
    nickname: inst.nickname,
    rarity: inst.rarity,
    description: sample?.description ?? 'A traded bug from another collector.',
    biome: sample?.biome ?? 'garden',
    traits: sample?.traits ?? ['Traded'],
    size: sample?.size ?? 'small',
    xpValue: stats.maxXp,
    level,
    xp: 0,
    maxXp: stats.maxXp,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    maxHp: hpForLevel,
    currentHp: hpForLevel,
  };
}

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

  // Bug snapshots read from the trade doc (no cross-user inventory read needed)
  const fromSnapshot: BugSnapshot | null = trade?.fromBugSnapshot ?? null;
  const toSnapshot: BugSnapshot | null = trade?.toBugSnapshot ?? null;

  // Completion flow state
  const [completionHandled, setCompletionHandled] = useState(false);
  const [completionSyncing, setCompletionSyncing] = useState(false);
  const [receivedBug, setReceivedBug] = useState<Bug | null>(null);

  // Local bugs
  const { collection: bugCollection, releaseBug, receiveTradedBug } = useBugCollection();

  // Recipient bug picker
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [settingBug, setSettingBug] = useState(false);

  // Countdown timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Subscribe to trade
  useEffect(() => {
    if (!tradeId) return;
    const unsub = subscribeTrade(
      tradeId,
      (t) => { setTrade(t); setLoading(false); },
      () => setLoading(false),
    );
    return unsub;
  }, [tradeId]);

  // Load partner profile
  useEffect(() => {
    if (!trade || !user) return;
    const partnerUid = trade.fromUid === user.uid ? trade.toUid : trade.fromUid;
    getUserProfile(partnerUid).then(setPartnerProfile);
  }, [trade?.fromUid, trade?.toUid, user?.uid]);

  // (Bug details come from trade.fromBugSnapshot / trade.toBugSnapshot —
  //  no cross-user Firestore reads needed.)

  // Handle trade completion: sync local collection
  useEffect(() => {
    if (!trade || trade.status !== 'completed' || completionHandled || !user) return;
    setCompletionHandled(true);
    setCompletionSyncing(true);

    const syncCompletion = async () => {
      const isFrom = trade.fromUid === user.uid;
      const myBugId = isFrom ? trade.fromBugId : trade.toBugId;
      const receivedBugId = isFrom ? trade.toBugId : trade.fromBugId;

      // Remove the bug I traded from my local collection
      if (myBugId) releaseBug(myBugId);

      // Fetch the received bug from MY Firestore inventory (Cloud Function moved it there)
      // Retry up to 3× with 1 s delay to account for Firestore propagation
      let receivedInstance: BugInstance | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        receivedInstance = await getFirestoreBug(user.uid, receivedBugId);
        if (receivedInstance) break;
        await new Promise(r => setTimeout(r, 1000));
      }

      if (receivedInstance && receivedBugId) {
        const bugData = bugInstanceToLocalBug(receivedInstance);
        const added = await receiveTradedBug(receivedBugId, bugData);
        setReceivedBug(added);
      }
    };

    syncCompletion()
      .catch(err => console.warn('[TradeSession] Completion sync failed:', err))
      .finally(() => setCompletionSyncing(false));
  }, [trade?.status, completionHandled, user?.uid]);

  // All local bugs (collection + party), deduplicated
  const allLocalBugs = useMemo(() => {
    const map = new Map<string, Bug>();
    for (const b of bugCollection.bugs) map.set(b.id, b);
    for (const b of bugCollection.party) {
      if (b) map.set(b.id, b);
    }
    return Array.from(map.values());
  }, [bugCollection.bugs, bugCollection.party]);

  // Derived state
  const isFrom = trade?.fromUid === user?.uid;
  const myAccepted = isFrom ? trade?.fromAccepted : trade?.toAccepted;
  const partnerAccepted = isFrom ? trade?.toAccepted : trade?.fromAccepted;
  const isTerminal = trade
    ? ['completed', 'declined', 'cancelled', 'expired'].includes(trade.status)
    : false;

  const myBugId = isFrom ? trade?.fromBugId : trade?.toBugId;
  const partnerBugId = isFrom ? trade?.toBugId : trade?.fromBugId;
  const needsRecipientPick = !isFrom && !trade?.toBugId;
  const bothBugsSet = !!(trade?.fromBugId && trade?.toBugId);

  const mySnapshot = isFrom ? fromSnapshot : toSnapshot;
  const partnerSnapshot = isFrom ? toSnapshot : fromSnapshot;

  const timeRemaining = useMemo(() => {
    if (!trade?.expiresAt) return '';
    const diff = trade.expiresAt.toMillis() - now;
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [trade, now]);

  const isExpired = trade?.expiresAt ? trade.expiresAt.toMillis() < now : false;

  // ── Handlers ───────────────────────────────────────────────────────

  const handleSetBug = useCallback(async () => {
    if (!tradeId || !user || !selectedBugId) return;
    const bug = allLocalBugs.find(b => b.id === selectedBugId);
    if (!bug) return;
    setSettingBug(true);
    try {
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
      Alert.alert('Trade Error', err instanceof Error ? err.message : 'Action failed. Please try again.');
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
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [tradeId, user, isFrom, router]);

  const styles = createStyles(theme);

  // ── Loading ────────────────────────────────────────────────────────
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

  // ── Completion: finalising spinner ─────────────────────────────────
  if (trade.status === 'completed' && completionSyncing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <ThemedText style={styles.loadingText}>Finalising trade…</ThemedText>
          <ThemedText style={[styles.subText, { color: theme.colors.textMuted }]}>
            Updating your collection
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  // ── Completion: success screen ─────────────────────────────────────
  if (trade.status === 'completed' && !completionSyncing) {
    const rarityColor = receivedBug ? (RARITY_COLORS[receivedBug.rarity] ?? '#9CA3AF') : '#22C55E';
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ThemedText style={styles.statusEmoji}>✅</ThemedText>
          <ThemedText style={styles.statusTitle}>Trade Complete!</ThemedText>
          {receivedBug && (
            <View style={[styles.receivedCard, { backgroundColor: theme.colors.card, borderColor: rarityColor }]}>
              <ThemedText style={[styles.receivedLabel, { color: theme.colors.textMuted }]}>
                YOU RECEIVED
              </ThemedText>
              <View style={[styles.rarityDot, { backgroundColor: rarityColor, alignSelf: 'center', marginBottom: 8 }]} />
              <ThemedText style={styles.receivedName}>
                {receivedBug.nickname ?? receivedBug.name}
              </ThemedText>
              <ThemedText style={[styles.receivedMeta, { color: theme.colors.textMuted }]}>
                Lv.{receivedBug.level} · {receivedBug.rarity}
              </ThemedText>
              <ThemedText style={[styles.receivedStats, { color: theme.colors.textMuted }]}>
                ⚔ {receivedBug.attack}  🛡 {receivedBug.defense}  ⚡ {receivedBug.speed}
              </ThemedText>
            </View>
          )}
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

  // ── Terminal state (declined / cancelled / expired) ────────────────
  if (isTerminal) {
    const statusEmoji: Record<string, string> = {
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

  // ── Bug detail card ────────────────────────────────────────────────
  const renderBugCard = (snap: BugSnapshot | null, label: string, waiting = false) => {
    const rarityColor = snap ? (RARITY_COLORS[snap.rarity] ?? '#9CA3AF') : '#9CA3AF';
    const sample = snap
      ? SAMPLE_BUGS.find(b => b.species === snap.speciesId || b.name === snap.speciesId)
      : null;
    const displayName = snap ? (snap.nickname ?? sample?.name ?? snap.speciesId) : null;
    return (
      <View style={styles.offerSide}>
        <ThemedText style={[styles.offerLabel, { color: theme.colors.textMuted }]}>
          {label}
        </ThemedText>
        <View style={[styles.offerCard, {
          backgroundColor: theme.colors.card,
          borderColor: snap ? rarityColor : theme.colors.border,
        }]}>
          {snap ? (
            <>
              <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
              <ThemedText style={styles.offerName} numberOfLines={1}>{displayName}</ThemedText>
              <ThemedText style={[styles.offerMeta, { color: theme.colors.textMuted }]}>
                Lv.{snap.level} · {snap.rarity}
              </ThemedText>
            </>
          ) : (
            <ThemedText style={[styles.offerPending, { color: theme.colors.textMuted }]}>
              {waiting ? 'Waiting…' : 'Not set'}
            </ThemedText>
          )}
        </View>
      </View>
    );
  };

  // ── RECIPIENT BUG PICKER ───────────────────────────────────────────
  if (needsRecipientPick) {
    const pickerBugData = allLocalBugs.find(b => b.id === selectedBugId);
    const senderSample = fromSnapshot
      ? SAMPLE_BUGS.find(b => b.species === fromSnapshot.speciesId || b.name === fromSnapshot.speciesId)
      : null;

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
            Pick a bug from your collection to offer back
          </ThemedText>
        </View>

        {/* Sender's offered bug */}
        <View style={[styles.offerBanner, {
          backgroundColor: theme.colors.card,
          borderColor: fromSnapshot
            ? (RARITY_COLORS[fromSnapshot.rarity] ?? theme.colors.primary)
            : theme.colors.primary,
        }]}>
          <ThemedText style={[styles.offerLabel, { color: theme.colors.textMuted }]}>
            THEIR OFFER
          </ThemedText>
          {fromSnapshot ? (
            <View style={styles.bannerRow}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[fromSnapshot.rarity] ?? '#9CA3AF' }]} />
              <ThemedText style={styles.offerName}>
                {fromSnapshot.nickname ?? senderSample?.name ?? fromSnapshot.speciesId}
              </ThemedText>
              <ThemedText style={[styles.offerMeta, { color: theme.colors.textMuted }]}>
                Lv.{fromSnapshot.level} · {fromSnapshot.rarity}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.offerName}>🐛 Bug #{trade.fromBugId.slice(0, 8)}</ThemedText>
          )}
        </View>

        {/* Recipient's selected bug preview */}
        {pickerBugData && (
          <View style={[styles.offerBanner, { backgroundColor: theme.colors.card, borderColor: '#22C55E' }]}>
            <ThemedText style={[styles.offerLabel, { color: theme.colors.textMuted }]}>
              YOUR OFFER
            </ThemedText>
            <View style={styles.bannerRow}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[pickerBugData.rarity] ?? '#9CA3AF' }]} />
              <ThemedText style={styles.offerName}>
                {pickerBugData.nickname ?? pickerBugData.name}
              </ThemedText>
              <ThemedText style={[styles.offerMeta, { color: theme.colors.textMuted }]}>
                Lv.{pickerBugData.level} · {pickerBugData.rarity}
              </ThemedText>
            </View>
          </View>
        )}

        {/* Bug list */}
        {allLocalBugs.length === 0 ? (
          <View style={styles.center}>
            <ThemedText style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No bugs available for trading
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={allLocalBugs}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = selectedBugId === item.id;
              const rarityColor = RARITY_COLORS[item.rarity] ?? '#9CA3AF';
              return (
                <TouchableOpacity
                  style={[styles.bugCard, {
                    backgroundColor: theme.colors.card,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    borderWidth: isSelected ? 3 : 1,
                  }]}
                  onPress={() => setSelectedBugId(isSelected ? null : item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.bugRow}>
                    <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
                    <View style={styles.bugInfo}>
                      <ThemedText style={styles.bugName}>{item.nickname ?? item.name}</ThemedText>
                      <ThemedText style={[styles.bugMeta, { color: theme.colors.textMuted }]}>
                        Lv.{item.level} · {item.rarity}
                      </ThemedText>
                    </View>
                    {isSelected && (
                      <ThemedText style={[styles.checkmark, { color: theme.colors.primary }]}>✓</ThemedText>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmBtn, {
              backgroundColor: theme.colors.primary,
              opacity: !selectedBugId || settingBug ? 0.5 : 1,
            }]}
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

  // ── MAIN TRADE SESSION ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Timer */}
        <View style={[styles.timerBar, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={[styles.timerLabel, { color: theme.colors.textMuted }]}>
            Time Remaining
          </ThemedText>
          <ThemedText style={[styles.timerValue, { color: isExpired ? '#EF4444' : theme.colors.text }]}>
            {timeRemaining}
          </ThemedText>
        </View>

        {/* Header */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={styles.cardTitle}>Trade Session</ThemedText>
          <ThemedText style={[styles.cardSub, { color: theme.colors.textMuted }]}>
            with {partnerProfile?.displayName ?? 'Loading…'}
          </ThemedText>
        </View>

        {/* Offers side by side */}
        <View style={styles.offersRow}>
          {renderBugCard(mySnapshot, 'Your Offer')}
          <ThemedText style={[styles.swapIcon, { color: theme.colors.textMuted }]}>⇄</ThemedText>
          {renderBugCard(partnerSnapshot, 'Their Offer', true)}
        </View>

        {/* Acceptance */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={styles.cardTitle}>Acceptance</ThemedText>
          <ThemedText style={[styles.acceptHint, { color: theme.colors.textMuted }]}>
            Both players must accept to complete the trade
          </ThemedText>
          <View style={styles.acceptRow}>
            <View style={styles.acceptSide}>
              <ThemedText style={styles.acceptLabel}>You</ThemedText>
              <View style={[styles.acceptBadge, {
                backgroundColor: myAccepted ? '#22C55E20' : '#EF444420',
                borderColor: myAccepted ? '#22C55E' : '#EF4444',
              }]}>
                <ThemedText style={[styles.acceptText, { color: myAccepted ? '#22C55E' : '#EF4444' }]}>
                  {myAccepted ? '✓ Ready' : '✗ Pending'}
                </ThemedText>
              </View>
            </View>
            <View style={styles.acceptSide}>
              <ThemedText style={styles.acceptLabel}>Partner</ThemedText>
              <View style={[styles.acceptBadge, {
                backgroundColor: partnerAccepted ? '#22C55E20' : '#EF444420',
                borderColor: partnerAccepted ? '#22C55E' : '#EF4444',
              }]}>
                <ThemedText style={[styles.acceptText, { color: partnerAccepted ? '#22C55E' : '#EF4444' }]}>
                  {partnerAccepted ? '✓ Ready' : '✗ Pending'}
                </ThemedText>
              </View>
            </View>
          </View>
          {myAccepted && !partnerAccepted && (
            <ThemedText style={[styles.waitingText, { color: theme.colors.textMuted }]}>
              Waiting for partner to accept…
            </ThemedText>
          )}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, {
            backgroundColor: myAccepted ? '#EF4444' : '#22C55E',
            opacity: actionLoading || isExpired || !bothBugsSet ? 0.5 : 1,
          }]}
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
    subText: { marginTop: 6, fontSize: 13 },
    content: { flex: 1, padding: 16 },

    pickerHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    heading: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
    subheading: { fontSize: 14, marginTop: 4 },

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

    card: {
      borderRadius: 14,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 14,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    cardSub: { fontSize: 14 },

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

    offerBanner: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 12,
      borderWidth: 2,
      padding: 12,
    },
    bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    acceptHint: { fontSize: 12, marginBottom: 12 },
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
    waitingText: { fontSize: 12, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },

    list: { padding: 16, paddingBottom: 160 },
    bugCard: { borderRadius: 12, padding: 14, marginBottom: 10 },
    bugRow: { flexDirection: 'row', alignItems: 'center' },
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
      padding: 16,
      paddingBottom: 24,
      backgroundColor: theme.colors.background,
      borderTopWidth: 2,
      borderTopColor: theme.colors.border,
      gap: 10,
    },
    confirmBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
    declineBtn: { paddingVertical: 12, borderRadius: 14, borderWidth: 2, alignItems: 'center' },
    declineBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },

    statusEmoji: { fontSize: 56, marginBottom: 16 },
    statusTitle: { fontSize: 24, fontWeight: '900', marginBottom: 24 },
    backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, borderWidth: 2 },
    backBtnText: { fontWeight: '700', fontSize: 15 },

    receivedCard: {
      width: '100%',
      borderWidth: 2,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      marginBottom: 24,
    },
    receivedLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
    receivedName: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
    receivedMeta: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    receivedStats: { fontSize: 13, fontWeight: '600' },
  });
}
