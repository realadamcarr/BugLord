import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { login, register } from '@/src/services/socialAuth';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'login' | 'register';

const FIREBASE_ERROR_MAP: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/invalid-credential': 'Invalid email or password.',
};

function friendlyError(raw: string): string {
  for (const [code, msg] of Object.entries(FIREBASE_ERROR_MAP)) {
    if (raw.includes(code)) return msg;
  }
  return raw;
}

export default function SocialAuthScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'register' && !username.trim()) {
      setError('Please enter a username.');
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === 'register'
          ? await register(email.trim(), password, username.trim())
          : await login(email.trim(), password);

      if (result.success) {
        router.back();
      } else {
        setError(friendlyError(result.error ?? 'Something went wrong.'));
      }
    } catch (err: unknown) {
      setError(
        friendlyError(err instanceof Error ? err.message : 'Unknown error'),
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText style={styles.heading}>
            {mode === 'login' ? '👋 Welcome Back' : '🐛 Join BugLord'}
          </ThemedText>
          <ThemedText style={[styles.subheading, { color: theme.colors.textMuted }]}>
            {mode === 'login'
              ? 'Sign in to trade bugs with friends'
              : 'Create an account to get started'}
          </ThemedText>

          {/* ── Form ──────────────────────────────────────────── */}
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            {mode === 'register' && (
              <View style={styles.field}>
                <ThemedText style={styles.label}>Username</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                  placeholder="BugMaster42"
                  placeholderTextColor={theme.colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            <View style={styles.field}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.background,
                  },
                ]}
                placeholder="trainer@buglord.com"
                placeholderTextColor={theme.colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Password</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.background,
                  },
                ]}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {/* ── Error ───────────────────────────────────────── */}
            {error && (
              <View style={styles.errorBox}>
                <ThemedText style={styles.errorText}>⚠️ {error}</ThemedText>
              </View>
            )}

            {/* ── Submit ──────────────────────────────────────── */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: theme.colors.primary, opacity: loading ? 0.6 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.submitBtnText}>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Toggle mode ───────────────────────────────────── */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            <ThemedText style={[styles.toggleText, { color: theme.colors.textMuted }]}>
              {mode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}
            </ThemedText>
            <ThemedText style={[styles.toggleLink, { color: theme.colors.primary }]}>
              {mode === 'login' ? 'Register' : 'Sign In'}
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: 20, paddingTop: 32 },
    heading: { fontSize: 28, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
    subheading: { fontSize: 15, textAlign: 'center', marginTop: 6, marginBottom: 24 },
    card: {
      borderRadius: 14,
      padding: 20,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    field: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
    input: {
      borderWidth: 2,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
    },
    errorBox: {
      backgroundColor: '#FEE2E2',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    errorText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
    submitBtn: {
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 4,
    },
    submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
    toggleText: { fontSize: 14 },
    toggleLink: { fontSize: 14, fontWeight: '800' },
  });
}
