import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authenticated Home</Text>
      <Text style={styles.text}>Logged in as: {user?.fullName}</Text>
      <Text style={styles.text}>Role: {user?.role}</Text>
      <Text style={styles.notice}>This prototype uses real backend authentication and secure token storage.</Text>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Logout</Text>
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
    gap: 10,
  },
  title: {
    fontSize: 28,
    color: colors.primaryStrong,
    fontWeight: '800',
    marginBottom: 4,
  },
  text: {
    color: colors.text,
    fontSize: 16,
  },
  notice: {
    marginTop: 8,
    color: colors.mutedText,
  },
  button: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
