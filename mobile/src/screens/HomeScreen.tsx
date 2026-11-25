import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CategorySelector } from '../components/CategorySelector';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { captureCurrentLocation, LOCATION_PERMISSION_RECOVERY } from '../services/locationService';
import { createSos } from '../services/incidentApi';
import { enqueueIncident } from '../services/incidentQueue';
import { ApiError } from '../services/apiClient';
import { createClientGeneratedId } from '../utils/format';
import { IncidentType } from '../types/incidents';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const HOLD_MS = 1800;

export function HomeScreen({ navigation }: Props) {
  const { user, tokens, logout } = useAuth();
  const [category, setCategory] = useState<IncidentType>('other');
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const holdStarted = useRef(0);
  const activated = useRef(false);

  useEffect(() => {
    if (!holding) return;
    const timer = setInterval(() => {
      const next = Math.min(1, (Date.now() - holdStarted.current) / HOLD_MS);
      setProgress(next);
      if (next >= 1 && !activated.current) {
        activated.current = true;
        setHolding(false);
        setProgress(0);
        void activateSos();
      }
    }, 40);
    return () => clearInterval(timer);
  }, [holding]);

  const activateSos = async () => {
    if (busy || !tokens || !user) return;
    setBusy(true);
    const clientGeneratedId = createClientGeneratedId();
    const occurredAt = new Date().toISOString();
    try {
      const captured = await captureCurrentLocation();
      if (!captured.ok || !captured.location) {
        Alert.alert('Location unavailable', `${captured.message}\n\n${LOCATION_PERMISSION_RECOVERY}`, [{ text: 'OK' }]);
        return;
      }
      const payload = {
        incidentType: category,
        description: 'Emergency SOS activated. Immediate assistance requested.',
        location: { latitude: captured.location.latitude, longitude: captured.location.longitude },
        occurredAt,
        clientGeneratedId,
      };
      try {
        const result = await createSos(payload, tokens.accessToken);
        navigation.navigate('SubmissionResult', {
          outcome: 'delivered', incidentType: category, reference: result.incident.reference,
          incidentId: result.incident.id, message: result.duplicate ? 'This SOS was already received by the server.' : 'SOS received by the server.',
        });
      } catch (error) {
        // Only a transport failure is treated as offline. Server rejections stay visible as failures.
        if (!(error instanceof TypeError) && !(error instanceof ApiError && error.statusCode >= 500)) {
          navigation.navigate('SubmissionResult', {
            outcome: 'failed', incidentType: category, message: error instanceof Error ? error.message : 'SOS could not be submitted.',
          });
          return;
        }
        const queued = await enqueueIncident('sos', payload);
        navigation.navigate('SubmissionResult', {
          outcome: 'queued', incidentType: category, localId: queued.localId,
          message: 'SOS saved on this device and is waiting to sync. The server has not received it yet.',
        });
      }
    } catch (error) {
      navigation.navigate('SubmissionResult', {
        outcome: 'failed', incidentType: category, message: error instanceof Error ? error.message : 'SOS could not be prepared.',
      });
    } finally {
      setBusy(false);
    }
  };

  const startHold = () => {
    if (busy || holding) return;
    activated.current = false;
    holdStarted.current = Date.now();
    setProgress(0);
    setHolding(true);
  };
  const cancelHold = () => {
    if (!activated.current) {
      setHolding(false);
      setProgress(0);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topline}>
        <View><Text style={styles.eyebrow}>OKOA JAMII</Text><Text style={styles.greeting}>Hello, {user?.fullName?.split(' ')[0] ?? 'there'}</Text></View>
        <Pressable accessibilityRole="button" onPress={() => void logout()}><Text style={styles.logout}>Log out</Text></Pressable>
      </View>
      <Text style={styles.instruction}>If you are in immediate danger, hold the button to send an SOS.</Text>
      <View style={styles.sosWrap}>
        <Pressable accessibilityRole="button" accessibilityLabel={holding ? 'SOS activation progress. Release to cancel.' : 'Hold to activate emergency SOS'} accessibilityHint="Hold for two seconds to prepare and submit an SOS" accessibilityState={{ disabled: busy }} onPressIn={startHold} onPressOut={cancelHold} disabled={busy} style={[styles.sos, busy && styles.sosBusy]}>
          {busy ? <ActivityIndicator color="#fff" size="large" /> : <><Text style={styles.sosTitle}>{holding ? `${Math.ceil((1-progress)*1.8)}…` : 'SOS'}</Text><Text style={styles.sosSubtitle}>{holding ? 'Keep holding' : 'HOLD FOR HELP'}</Text></>}
        </Pressable>
        {holding && <View style={styles.track}><View style={[styles.fill, { width: `${progress*100}%` }]} /></View>}
      </View>
      <Text style={styles.hint}>{holding ? 'Release now to cancel.' : 'Your location is requested when you activate SOS.'}</Text>
      <CategorySelector value={category} onChange={setCategory} disabled={busy || holding} label="Emergency category" />
      <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('ReportIncident')}><Text style={styles.primaryText}>Report an incident</Text></Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('MyReports')}><Text style={styles.secondaryText}>My reports</Text></Pressable>
      <Text style={styles.disclaimer}>An SOS is a report to the Okoa Jamii server. It does not confirm that dispatch or responders have been contacted.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: 22, paddingTop: 48, gap: 16 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  greeting: { color: colors.text, fontSize: 25, fontWeight: '800', marginTop: 4 },
  logout: { color: colors.primary, fontWeight: '700', padding: 8 },
  instruction: { color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  sosWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 6, gap: 12 },
  sos: { width: 208, height: 208, borderRadius: 104, backgroundColor: '#B42318', alignItems: 'center', justifyContent: 'center', borderWidth: 9, borderColor: '#F7C7C2', elevation: 5 },
  sosBusy: { opacity: 0.82 },
  sosTitle: { color: '#fff', fontSize: 52, fontWeight: '900', letterSpacing: 2 },
  sosSubtitle: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  track: { height: 8, width: 208, backgroundColor: '#E8C5C1', borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#B42318' },
  hint: { textAlign: 'center', color: colors.mutedText, fontSize: 13 },
  primaryButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 3 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { backgroundColor: colors.card, padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.primaryStrong, fontSize: 16, fontWeight: '700' },
  disclaimer: { color: colors.mutedText, fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 8 },
});
