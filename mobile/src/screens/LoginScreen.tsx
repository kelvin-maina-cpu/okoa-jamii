import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

interface Props {
  onGoRegister: () => void;
  onForgotPassword: () => void;
}

export function LoginScreen({ onGoRegister, onForgotPassword }: Props) {
  const { login, loginLoading, errorMessage, clearError } = useAuth();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
    clearError();
    if (!emailOrPhone.trim() || !password) {
      setValidationError('Enter your email/phone and password.');
      return;
    }

    setValidationError(null);
    try {
      await login({ emailOrPhone: emailOrPhone.trim(), password });
    } catch {
      // Error is surfaced by context state.
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Welcome back</Text>
      <Text style={styles.subheading}>Sign in to continue reporting and tracking incidents.</Text>

      <TextInput
        style={styles.input}
        value={emailOrPhone}
        onChangeText={setEmailOrPhone}
        autoCapitalize="none"
        placeholder="Email or phone"
        placeholderTextColor={colors.mutedText}
      />
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          placeholder="Password"
          placeholderTextColor={colors.mutedText}
        />
        <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.toggleButton}>
          <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      {(validationError || errorMessage) && <Text style={styles.errorText}>{validationError || errorMessage}</Text>}

      <Pressable style={styles.primaryButton} onPress={submit} disabled={loginLoading}>
        {loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign In</Text>}
      </Pressable>

      <Pressable onPress={onForgotPassword}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>

      <Pressable onPress={onGoRegister}>
        <Text style={styles.link}>Need an account? Register</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primaryStrong,
  },
  subheading: {
    color: colors.mutedText,
    lineHeight: 20,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
    color: colors.text,
  },
  toggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toggleText: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorText: {
    color: colors.accent,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
