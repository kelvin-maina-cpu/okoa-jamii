import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Password Recovery</Text>
      <Text style={styles.notice}>
        Recovery is not available yet in this prototype. Please contact an authorized administrator for temporary account assistance.
      </Text>
      <Pressable style={styles.button} onPress={onBack}>
        <Text style={styles.buttonText}>Back to Login</Text>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryStrong,
    marginBottom: 12,
  },
  notice: {
    color: colors.text,
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
