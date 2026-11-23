import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  onLogin: () => void;
  onRegister: () => void;
}

export function WelcomeScreen({ onLogin, onRegister }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Okoa Jamii</Text>
      <Text style={styles.subtitle}>Community-first emergency response for Kenya.</Text>
      <Text style={styles.caption}>
        This prototype helps citizens report incidents quickly and securely even when network access is unreliable.
      </Text>

      <Pressable style={styles.primaryButton} onPress={onRegister} accessibilityRole="button">
        <Text style={styles.primaryButtonText}>Create Citizen Account</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onLogin} accessibilityRole="button">
        <Text style={styles.secondaryButtonText}>I already have an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.primaryStrong,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 14,
    fontWeight: '600',
  },
  caption: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    borderColor: colors.primary,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
});
