import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { isValidFriendCode } from '@/src/lib/friendCode';
import { FriendRequest } from '@/src/models/friends';
import { Trade } from '@/src/models/trades';
import {
    acceptFriendRequest,
    declineFriendRequest,
    lookupByFriendCode,
    sendFriendRequest,
    subscribeFriends,
    subscribeIncomingFriendRequests,
    subscribeOutgoingFriendRequests,
} from '@/src/services/friendsService';
import { ensureUserProfile, getUserProfile, logout, UserProfile } from '@/src/services/socialAuth';
import { subscribeIncomingTrades } from '@/src/services/tradeService';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SocialScreen() {
  const { theme } = useTheme();
  const { user, loading: authLoading } = useAuthUser();
  const router = useRouter();

  // ── Profile state ────────────────────────────────────────────────
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Friend code input ────────────────────────────────────────────
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // ── Friends & requests ───────────────────────────────────────────
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [friendUids, setFriendUids] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  // ── Incoming trades ──────────────────────────────────────────────
  const [incomingTrades, setIncomingTrades] = useState<Trade[]>([]);

  // ── Copied badge ─────────────────────────────────────────────────
  const [copiedVisible, setCopiedVisible] = useState(false);

  // Load (or create) profile when user changes
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    ensureUserProfile(user)
      .then(setProfile)
      .finally(() => setProfileLoading(false));
  }, [user]);

  // Subscribe to friend requests
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeIncomingFriendRequests(user.uid, setFriendRequests);
    return unsub;
  }, [user]);

  // Subscribe to outgoing sent requests
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeOutgoingFriendRequests(user.uid, setSentRequests);
    return unsub;
  }, [user]);

  // Subscribe to friends list
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeFriends(user.uid, setFriendUids);
    return unsub;
  }, [user]);

  // Load friend profiles when UIDs change
  useEffect(() => {
    if (friendUids.length === 0) {
      setFriendProfiles([]);
      return;
    }
    Promise.all(friendUids.map((uid) => getUserProfile(uid))).then(
      (profiles) => setFriendProfiles(profiles.filter(Boolean) as UserProfile[]),
    );
  }, [friendUids]);

  // Subscribe to incoming trades
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeIncomingTrades(user.uid, setIncomingTrades);
    return unsub;
  }, [user]);

  // ── Handlers ─────────────────────────────────────────────────────

  const copyFriendCode = useCallback(async () => {
    if (!profile?.friendCode) return;
    await Clipboard.setStringAsync(profile.friendCode);
    setCopiedVisible(true);
    setTimeout(() => setCopiedVisible(false), 2000);
  }, [profile]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!user || !friendCodeInput.trim()) return;
    const code = friendCodeInput.trim().toUpperCase();

    if (!isValidFriendCode(code)) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-character friend code.');
      return;
    }

    setSendingRequest(true);
    try {
      const found = await lookupByFriendCode(code);
      if (!found) {
        Alert.alert('Not Found', 'No player with that friend code was found.');
        return;
      }
      if (found.uid === user.uid) {
        Alert.alert('Oops', "That's your own friend code!");
        return;
      }
      const result = await sendFriendRequest(user.uid, found.uid);
      if (result.success) {
        Alert.alert('Sent!', `Friend request sent to ${found.displayName}.`);
        setFriendCodeInput('');
      } else {
        Alert.alert('Error', result.error ?? 'Failed to send request.');
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSendingRequest(false);
    }
  }, [user, friendCodeInput]);

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      setProcessingRequest(requestId);
      try {
        await acceptFriendRequest(requestId);
      } catch (err: unknown) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept');
      } finally {
        setProcessingRequest(null);
      }
    },
    [],
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      setProcessingRequest(requestId);
      try {
        await declineFriendRequest(requestId);
      } catch (err: unknown) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to decline');
      } finally {
        setProcessingRequest(null);
      }
    },
    [],
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, []);

  const styles = createStyles(theme);

  // ── Loading ──────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Logged-out state ─────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ThemedText style={styles.title}>🐛 Social</ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to add friends and trade bugs!
          </ThemedText>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/social-auth' as any)}
          >
            <ThemedText style={styles.primaryBtnText}>Sign In / Register</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Logged-in state ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>🐛 Social</ThemedText>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <ThemedText style={styles.logoutText}>Sign Out</ThemedText>
          </TouchableOpacity>
        </View>

        {/* ── My Friend Code ──────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={styles.cardTitle}>My Friend Code</ThemedText>
          {profileLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <View style={styles.friendCodeRow}>
              <ThemedText style={styles.friendCode}>
                {profile?.friendCode ?? '------'}
              </ThemedText>
              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: theme.colors.primary }]}
                onPress={copyFriendCode}
              >
                <ThemedText style={styles.copyBtnText}>
                  {copiedVisible ? '✓ Copied' : 'Copy'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
          <ThemedText style={[styles.hint, { color: theme.colors.textMuted }]}>
            Share this code with friends so they can add you
          </ThemedText>
        </View>

        {/* ── Add Friend ──────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={styles.cardTitle}>Add Friend</ThemedText>
          <View style={styles.addFriendRow}>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.background,
                },
              ]}
              placeholder="Enter friend code"
              placeholderTextColor={theme.colors.textMuted}
              value={friendCodeInput}
              onChangeText={(t) => setFriendCodeInput(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: sendingRequest || !friendCodeInput.trim() ? 0.5 : 1,
                },
              ]}
              onPress={handleSendFriendRequest}
              disabled={sendingRequest || !friendCodeInput.trim()}
            >
              {sendingRequest ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.sendBtnText}>Send</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Incoming Friend Requests ────────────────────────────── */}
        {friendRequests.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <ThemedText style={styles.cardTitle}>
              Friend Requests ({friendRequests.length})
            </ThemedText>
            {friendRequests.map((req) => (
              <FriendRequestRow
                key={req.id}
                request={req}
                processing={processingRequest === req.id}
                onAccept={() => handleAcceptRequest(req.id)}
                onDecline={() => handleDeclineRequest(req.id)}
                theme={theme}
              />
            ))}
          </View>
        )}

        {/* ── Sent (Outgoing) Friend Requests ─────────────────────── */}
        {sentRequests.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <ThemedText style={styles.cardTitle}>
              Sent Requests ({sentRequests.length})
            </ThemedText>
            {sentRequests.map((req) => (
              <SentRequestRow
                key={req.id}
                request={req}
                theme={theme}
              />
            ))}
          </View>
        )}

        {/* ── Friends List ────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText style={styles.cardTitle}>
            Friends ({friendProfiles.length})
          </ThemedText>
          {friendProfiles.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No friends yet. Share your friend code to get started!
            </ThemedText>
          ) : (
            friendProfiles.map((friend) => (
              <View key={friend.uid} style={styles.friendRow}>
                <View style={styles.friendInfo}>
                  <ThemedText style={styles.friendName}>
                    {friend.displayName}
                  </ThemedText>
                  <ThemedText style={[styles.friendSub, { color: theme.colors.textMuted }]}>
                    {friend.friendCode}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={[styles.tradeBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() =>
                    router.push({
                      pathname: '/social-trade-create' as any,
                      params: { friendUid: friend.uid, friendName: friend.displayName },
                    })
                  }
                >
                  <ThemedText style={styles.tradeBtnText}>Trade</ThemedText>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ── Incoming Trades ─────────────────────────────────────── */}
        {incomingTrades.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <ThemedText style={styles.cardTitle}>
              Incoming Trades ({incomingTrades.length})
            </ThemedText>
            {incomingTrades.map((trade) => (
              <TouchableOpacity
                key={trade.id}
                style={styles.tradeRow}
                onPress={() =>
                  router.push({
                    pathname: '/social-trade-session' as any,
                    params: { tradeId: trade.id },
                  })
                }
              >
                <ThemedText style={styles.tradeRowText}>
                  Trade from {trade.fromUid.slice(0, 8)}…
                </ThemedText>
                <ThemedText style={[styles.tradeRowArrow, { color: theme.colors.primary }]}>
                  →
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Friend Request Row ──────────────────────────────────────────────

function FriendRequestRow({
  request,
  processing,
  onAccept,
  onDecline,
  theme,
}: {
  request: FriendRequest;
  processing: boolean;
  onAccept: () => void;
  onDecline: () => void;
  theme: any;
}) {
  const [senderProfile, setSenderProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getUserProfile(request.fromUid).then(setSenderProfile);
  }, [request.fromUid]);

  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.info}>
        <ThemedText style={rowStyles.name}>
          {senderProfile?.displayName ?? request.fromUid.slice(0, 8)}
        </ThemedText>
      </View>
      {processing ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <View style={rowStyles.actions}>
          <TouchableOpacity
            style={[rowStyles.acceptBtn, { backgroundColor: '#22C55E' }]}
            onPress={onAccept}
          >
            <ThemedText style={rowStyles.btnText}>Accept</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[rowStyles.declineBtn, { backgroundColor: '#EF4444' }]}
            onPress={onDecline}
          >
            <ThemedText style={rowStyles.btnText}>Decline</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  declineBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

// ── Sent Request Row ────────────────────────────────────────────────

function SentRequestRow({
  request,
  theme,
}: Readonly<{
  request: FriendRequest;
  theme: any;
}>) {
  const [recipientProfile, setRecipientProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getUserProfile(request.toUid).then(setRecipientProfile);
  }, [request.toUid]);

  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.info}>
        <ThemedText style={rowStyles.name}>
          {recipientProfile?.displayName ?? request.toUid.slice(0, 8)}
        </ThemedText>
      </View>
      <ThemedText style={{ fontSize: 13, fontStyle: 'italic', color: theme.colors.textMuted }}>
        Pending…
      </ThemedText>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    scroll: { padding: 16, paddingBottom: 40 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: { fontSize: 28, fontWeight: '900', letterSpacing: 1 },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      marginVertical: 16,
      color: theme.colors.textMuted,
    },
    primaryBtn: {
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 8,
    },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    logoutBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    logoutText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
    card: {
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10, letterSpacing: 0.5 },
    friendCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    friendCode: {
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 4,
      fontFamily: 'SpaceMono',
    },
    copyBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    copyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    hint: { fontSize: 12, marginTop: 6 },
    addFriendRow: { flexDirection: 'row', gap: 10 },
    input: {
      flex: 1,
      borderWidth: 2,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      letterSpacing: 2,
      fontWeight: '700',
    },
    sendBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, justifyContent: 'center' },
    sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    emptyText: { fontSize: 14, fontStyle: 'italic', paddingVertical: 8 },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(128,128,128,0.15)',
    },
    friendInfo: { flex: 1 },
    friendName: { fontSize: 15, fontWeight: '700' },
    friendSub: { fontSize: 12, marginTop: 2 },
    tradeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    tradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    tradeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(128,128,128,0.15)',
    },
    tradeRowText: { flex: 1, fontSize: 14, fontWeight: '600' },
    tradeRowArrow: { fontSize: 20, fontWeight: '800' },
  });
}
