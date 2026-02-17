import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { Trade } from '@/src/models/trades';
import { getUserProfile, UserProfile } from '@/src/services/socialAuth';
import {
    cancelTrade,
    declineTrade,
    setTradeAcceptFlag,
    subscribeTrade,
    unsetTradeAcceptFlag,
} from '@/src/services/tradeService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  }, [trade, user]);

  // ── Derived state ──────────────────────────────────────────────
  const isFrom = trade?.fromUid === user?.uid;
  const myAccepted = isFrom ? trade?.fromAccepted : trade?.toAccepted;
  const partnerAccepted = isFrom ? trade?.toAccepted : trade?.fromAccepted;
  const isTerminal = trade
    ? ['completed', 'declined', 'cancelled', 'expired'].includes(trade.status)
    : false;

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
    Alert.alert('Cancel Trade', 'Are you sure you want to cancel this trade?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
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
              err instanceof Error ? err.message : 'Failed to cancel',
            );
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [tradeId, user, isFrom, router]);

  const styles = createStyles(theme);

  // ── Loading ────────────────────────────────────────────────────
  if (loading || !trade) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
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
      <SafeAreaView style={styles.container} edges={['bottom']}>
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* ── Timer ──────────────────────────────────────────── */}
        <View style={[styles.timerBar, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={[styles.timerLabel, { color: theme.colors.textMuted }]}>
            Time Remaining
          </ThemedText>
          <ThemedText
            style={[
              styles.timerValue,
              { color: isExpired ? '#EF4444' : theme.colors.text },
            ]}
          >
            {timeRemaining}
          </ThemedText>
        </View>

        {/* ── Trade Info ─────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={styles.cardTitle}>Trade Session</ThemedText>
          <ThemedText style={[styles.partnerName, { color: theme.colors.textMuted }]}>
            with {partnerProfile?.displayName ?? 'Loading…'}
          </ThemedText>

          {/* ── Bug IDs ──────────────────────────────────────── */}
          <View style={styles.bugSection}>
            <View style={styles.bugSide}>
              <ThemedText style={[styles.sideLabel, { color: theme.colors.textMuted }]}>
                {isFrom ? 'Your Offer' : "Their Offer"}
              </ThemedText>
              <View style={[styles.bugBox, { borderColor: theme.colors.border }]}>
                <ThemedText style={styles.bugId}>
                  🐛 {trade.fromBugId.slice(0, 8) || 'None'}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.swapIcon}>⇄</ThemedText>

            <View style={styles.bugSide}>
              <ThemedText style={[styles.sideLabel, { color: theme.colors.textMuted }]}>
                {isFrom ? "Their Offer" : 'Your Offer'}
              </ThemedText>
              <View style={[styles.bugBox, { borderColor: theme.colors.border }]}>
                <ThemedText style={styles.bugId}>
                  🐛 {trade.toBugId.slice(0, 8) || 'Pending'}
                </ThemedText>
              </View>
            </View>
          </View>
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
                  style={[
                    styles.acceptText,
                    { color: myAccepted ? '#22C55E' : '#EF4444' },
                  ]}
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
                  style={[
                    styles.acceptText,
                    { color: partnerAccepted ? '#22C55E' : '#EF4444' },
                  ]}
                >
                  {partnerAccepted ? '✓ Accepted' : '✗ Pending'}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* ── Actions ─────────────────────────────────────────── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.acceptBtn,
              {
                backgroundColor: myAccepted ? '#EF4444' : '#22C55E',
                opacity: actionLoading || isExpired ? 0.5 : 1,
              },
            ]}
            onPress={handleToggleAccept}
            disabled={actionLoading || isExpired}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.acceptBtnText}>
                {myAccepted ? 'Revoke Accept' : 'Accept Trade'}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: '#EF4444' }]}
            onPress={handleCancel}
            disabled={actionLoading}
          >
            <ThemedText style={styles.cancelBtnText}>
              {isFrom ? 'Cancel Trade' : 'Decline Trade'}
            </ThemedText>
          </TouchableOpacity>
        </View>
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

    // Timer
    timerBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    timerLabel: { fontSize: 14, fontWeight: '600' },
    timerValue: { fontSize: 24, fontWeight: '900', fontFamily: 'SpaceMono', letterSpacing: 2 },

    // Card
    card: {
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
    partnerName: { fontSize: 14, marginBottom: 14 },

    // Bugs
    bugSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bugSide: { flex: 1, alignItems: 'center' },
    sideLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    bugBox: {
      width: '100%',
      borderWidth: 2,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
    },
    bugId: { fontSize: 14, fontWeight: '700' },
    swapIcon: { fontSize: 24, fontWeight: '900', color: theme.colors.textMuted },

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

    // Actions
    actions: { marginTop: 8, gap: 12 },
    acceptBtn: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
    },
    acceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
    cancelBtn: {
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 2,
      alignItems: 'center',
    },
    cancelBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },

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
