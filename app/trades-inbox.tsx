/**
 * Trades Inbox Screen
 *
 * Shows incoming trade proposals with Accept / Decline actions.
 * Accept calls the acceptTrade Cloud Function; decline updates
 * Firestore client-side.
 */

import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { Trade } from '@/src/models/trades';
import { callAcceptTrade } from '@/src/services/functions';
import { declineTrade, subscribeIncomingTrades } from '@/src/services/tradeService';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    ToastAndroid,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Helpers ──────────────────────────────────────────────────────────

function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('', message);
  }
}

function friendlyFirebaseError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    switch (code) {
      case 'functions/permission-denied':
        return 'You don\u2019t have permission to accept this trade.';
      case 'functions/failed-precondition':
        return 'This trade can no longer be accepted. It may have been cancelled or already completed.';
      case 'functions/not-found':
        return 'Trade not found. It may have been deleted.';
      case 'functions/unavailable':
        return 'Server is temporarily unavailable. Please try again.';
      default:
        break;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

// ── Screen ───────────────────────────────────────────────────────────

export default function TradesInboxScreen() {
  const { theme } = useTheme();
  const { user, loading: authLoading } = useAuthUser();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const styles = createStyles(theme);

  // Subscribe to incoming trades
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeIncomingTrades(
      user.uid,
      (incoming) => setTrades(incoming),
      (err) => console.warn('[TradesInbox] subscription error:', err),
    );
    return unsub;
  }, [user]);

  // ── Loading helpers ────────────────────────────────────────────────

  const setRowLoading = useCallback((tradeId: string, busy: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(tradeId);
      else next.delete(tradeId);
      return next;
    });
  }, []);

  // ── Actions ────────────────────────────────────────────────────────

  const handleAccept = useCallback(
    async (trade: Trade) => {
      setRowLoading(trade.id, true);
      try {
        await callAcceptTrade(trade.id);
        showToast('Trade completed!');
      } catch (err) {
        Alert.alert('Trade Failed', friendlyFirebaseError(err));
      } finally {
        setRowLoading(trade.id, false);
      }
    },
    [setRowLoading],
  );

  const handleDecline = useCallback(
    async (trade: Trade) => {
      if (!user) return;
      setRowLoading(trade.id, true);
      try {
        await declineTrade(trade.id, user.uid);
        showToast('Trade declined');
      } catch (err) {
        Alert.alert('Error', friendlyFirebaseError(err));
      } finally {
        setRowLoading(trade.id, false);
      }
    },
    [user, setRowLoading],
  );

  // ── Render ─────────────────────────────────────────────────────────

  const renderTradeRow = ({ item: trade }: { item: Trade }) => {
    const busy = loadingIds.has(trade.id);

    return (
      <View style={styles.tradeRow}>
        <View style={styles.tradeInfo}>
          <ThemedText style={styles.tradeLabel}>
            From: <Text style={styles.tradeUid}>{trade.fromUid.slice(0, 8)}…</Text>
          </ThemedText>
          <ThemedText style={styles.tradeBugs}>
            Offering #{trade.fromBugId.slice(0, 6)} → Wants #{trade.toBugId.slice(0, 6)}
          </ThemedText>
        </View>

        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleAccept(trade)}
            >
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={() => handleDecline(trade)}
            >
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ThemedText>Sign in to view trade requests.</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Trade Inbox</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {trades.length === 0 ? (
        <View style={styles.emptyContainer}>
          <PixelatedEmoji type="bug" size={48} color={theme.colors.textSecondary} />
          <ThemedText style={styles.emptyText}>No incoming trades</ThemedText>
        </View>
      ) : (
        <FlatList
          data={trades}
          keyExtractor={(t) => t.id}
          renderItem={renderTradeRow}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 8,
      paddingHorizontal: 16,
      paddingBottom: 14,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 3,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 6,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    backButtonText: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '900',
      color: theme.colors.text,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    headerSpacer: {
      width: 36,
    },
    list: {
      padding: 16,
      paddingBottom: 40,
    },
    tradeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderRadius: 10,
      borderWidth: 3,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: 12,
    },
    tradeInfo: {
      flex: 1,
      marginRight: 12,
    },
    tradeLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
    },
    tradeUid: {
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    tradeBugs: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: 2,
    },
    acceptButton: {
      backgroundColor: '#2d6a2e',
      borderColor: '#1e4d1f',
    },
    acceptText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    declineButton: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    },
    declineText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
  });
