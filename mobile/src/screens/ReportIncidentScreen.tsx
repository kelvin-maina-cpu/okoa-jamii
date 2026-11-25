import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CategorySelector } from '../components/CategorySelector';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { captureCurrentLocation, LOCATION_PERMISSION_RECOVERY } from '../services/locationService';
import { submitIncidentLocallyFirst } from '../services/incidentSync';
import { pickAudioEvidence, pickPhotoEvidence, EVIDENCE_NOT_UPLOADED_NOTICE } from '../services/evidenceService';
import { createClientGeneratedId } from '../utils/format';
import { IncidentEvidence, IncidentType } from '../types/incidents';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportIncident'>;
export function ReportIncidentScreen({ navigation }: Props) {
  const { tokens, user } = useAuth();
  const [category, setCategory] = useState<IncidentType>('other');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [locationMessage, setLocationMessage] = useState('Location has not been added.');
  const [evidence, setEvidence] = useState<IncidentEvidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addLocation = async () => {
    setLocationMessage('Getting GPS location…');
    const result = await captureCurrentLocation();
    if (result.ok && result.location) {
      setLocation({ latitude: result.location.latitude, longitude: result.location.longitude });
      setLocationMessage(result.message);
    } else {
      setLocation(undefined);
      setLocationMessage(`${result.message} ${LOCATION_PERMISSION_RECOVERY}`);
    }
  };
  const addEvidence = async (kind: 'photo' | 'audio') => {
    const result = kind === 'photo' ? await pickPhotoEvidence() : await pickAudioEvidence();
    if (result.ok) setEvidence((current) => [...current, result.evidence]);
    else if (result.message) Alert.alert('Attachment unavailable', result.message);
  };
  const submit = async () => {
    setError('');
    if (description.trim().length < 5) { setError('Describe what happened in at least 5 characters.'); return; }
    if (!location && area.trim().length < 3) { setError('Add GPS location or describe the area (at least 3 characters).'); return; }
    if (!tokens || !user) { setError('Your session is unavailable. Sign in again.'); return; }
    setBusy(true);
    const payload = { incidentType: category, description: description.trim(), location, addressOrArea: area.trim() || undefined, occurredAt: new Date().toISOString(), clientGeneratedId: createClientGeneratedId(), evidence };
    try {
      const result = await submitIncidentLocallyFirst('incident', payload, tokens.accessToken, user.id);
      if (result.outcome === 'delivered') navigation.replace('SubmissionResult', { outcome: 'delivered', incidentType: category, incidentId: result.incidentId, reference: result.incident?.reference, message: 'Report received by the server.' });
      else navigation.replace('SubmissionResult', { outcome: result.outcome, incidentType: category, localId: result.localId, message: result.message });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Report could not be saved locally.');
    } finally { setBusy(false); }
  };

  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}><Text style={styles.back}>‹  Back</Text></Pressable>
    <Text style={styles.title}>Report an incident</Text>
    <Text style={styles.intro}>Share what happened. Your report will be linked to your signed-in account.</Text>
    <CategorySelector value={category} onChange={setCategory} disabled={busy} label="Incident category" />
    <Text style={styles.label}>What happened? *</Text>
    <TextInput accessibilityLabel="Incident description" multiline maxLength={5000} value={description} onChangeText={setDescription} placeholder="Describe the incident and any immediate risks" style={[styles.input, styles.multiline]} />
    <View style={styles.row}><Text style={styles.label}>Location</Text><Pressable onPress={() => void addLocation()} style={styles.smallButton}><Text style={styles.smallText}>Use GPS</Text></Pressable></View>
    <Text style={styles.help}>{location ? `GPS captured: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : locationMessage}</Text>
    <TextInput accessibilityLabel="Location description" value={area} onChangeText={setArea} placeholder="Or describe the area / nearest landmark" maxLength={500} style={styles.input} />
    <Text style={styles.label}>Optional evidence</Text>
    <View style={styles.row}><Pressable onPress={() => void addEvidence('photo')} style={styles.smallButton}><Text style={styles.smallText}>Add photo</Text></Pressable><Pressable onPress={() => void addEvidence('audio')} style={styles.smallButton}><Text style={styles.smallText}>Choose audio</Text></Pressable></View>
    {!!evidence.length && <Text style={styles.help}>{evidence.map((item) => item.name).join(', ')}</Text>}
    <Text style={styles.notice}>{EVIDENCE_NOT_UPLOADED_NOTICE}</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable disabled={busy} onPress={() => void submit()} style={[styles.submit, busy && { opacity: 0.7 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit report</Text>}</Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: 22, paddingTop: 48, gap: 13 },
  back: { color: colors.primary, fontWeight: '700', fontSize: 16 }, title: { color: colors.text, fontSize: 27, fontWeight: '800' }, intro: { color: colors.mutedText, lineHeight: 20, marginBottom: 4 },
  label: { color: colors.text, fontWeight: '700' }, input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, color: colors.text, fontSize: 16 }, multiline: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, smallButton: { padding: 11, backgroundColor: colors.infoSoft, borderRadius: 9 }, smallText: { color: colors.primary, fontWeight: '700' }, help: { color: colors.mutedText, fontSize: 13, lineHeight: 18 }, notice: { color: colors.warning, backgroundColor: colors.warningSoft, padding: 10, borderRadius: 8, fontSize: 12, lineHeight: 17 }, error: { color: colors.danger, fontWeight: '600' },
  submit: { backgroundColor: colors.primary, borderRadius: 11, padding: 16, alignItems: 'center', marginTop: 3 }, submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
