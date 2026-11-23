import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

interface Props {
  onGoLogin: () => void;
}

export function RegisterScreen({ onGoLogin }: Props) {
  const { register, registerLoading, errorMessage, clearError } = useAuth();
  const [fullName, setFullName] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
    clearError();
    if (!fullName.trim()) {
      setValidationError('Full name is required.');
      return;
    }
    if (!emailOrPhone.trim()) {
      setValidationError('Email or phone is required.');
      return;
    }
    if (password.length < 8) {
      setValidationError('Password must have at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    const identifier = emailOrPhone.trim();
    const isEmail = identifier.includes('@');

    setValidationError(null);

    try {
      await register({
        fullName: fullName.trim(),
        email: isEmail ? identifier.toLowerCase() : undefined,
        phone: isEmail ? undefined : identifier,
        password,
        confirmPassword,
        preferredLanguage: 'en',
      });
    } catch {
      // Error state is shown from context.
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Create Account</Text>
      <Text style={styles.subheading}>Citizen registration only. Administrative accounts are provisioned by authorized administrators.</Text>

      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name"
        placeholderTextColor={colors.mutedText}
      />
      <TextInput
        style={styles.input}
        value={emailOrPhone}
        onChangeText={setEmailOrPhone}
        placeholder="Email or phone"
        autoCapitalize="none"
        placeholderTextColor={colors.mutedText}
      />

      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry={!showPassword}
          placeholderTextColor={colors.mutedText}
        />
        <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.toggleButton}>
          <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm password"
        secureTextEntry={!showPassword}
        placeholderTextColor={colors.mutedText}
      />

      {(validationError || errorMessage) && <Text style={styles.errorText}>{validationError || errorMessage}</Text>}

      <Pressable style={styles.primaryButton} onPress={submit} disabled={registerLoading}>
        {registerLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Register</Text>}
      </Pressable>

      <Pressable onPress={onGoLogin}>
        <Text style={styles.link}>Already registered? Sign in</Text>
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
    fontSize: 30,
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
