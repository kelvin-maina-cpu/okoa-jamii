import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getCategoryLabel } from '../constants/incidents';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'SubmissionResult'>;
export function SubmissionResultScreen({ route, navigation }: Props) {
  const { outcome, message, reference, incidentId, localId, incidentType, detail } = route.params;
  const delivered = outcome === 'delivered';
  const queued = outcome === 'queued';
  return <View style={styles.container}>
    <View style={[styles.symbol, delivered ? styles.ok : queued ? styles.pending : styles.failed]}><Text style={styles.symbolText}>{delivered ? '✓' : queued ? '…' : '!'}</Text></View>
    <Text accessibilityRole="header" style={styles.title}>{delivered ? 'Report received' : queued ? 'Saved on this device' : localId ? 'Not received by server' : 'Report not submitted'}</Text>
    <Text style={styles.message}>{message}</Text>
    {reference && <Text style={styles.reference}>Reference: {reference}</Text>}
    <Text style={styles.category}>{getCategoryLabel(incidentType)}</Text>
    {queued && <Text style={styles.notice}>The server has not received this report yet. Keep the app on this device and try again when connected.</Text>}
    {!delivered && !queued && localId && <Text style={styles.notice}>A local copy remains on this device. Review its error and use My reports to retry when appropriate.</Text>}
    {!delivered && !queued && detail && <Text style={styles.notice}>{detail}</Text>}
    <Pressable style={styles.button} onPress={() => incidentId ? navigation.replace('IncidentDetails', { incidentId }) : localId ? navigation.replace('IncidentDetails', { localId }) : navigation.replace('Home')}><Text style={styles.buttonText}>{incidentId || localId ? 'View report details' : 'Return to home'}</Text></Pressable>
    <Pressable onPress={() => navigation.navigate('MyReports')} style={styles.link}><Text style={styles.linkText}>My reports</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background, padding: 26, justifyContent: 'center', alignItems: 'center', gap: 16 }, symbol: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' }, ok: { backgroundColor: colors.successSoft }, pending: { backgroundColor: colors.warningSoft }, failed: { backgroundColor: colors.dangerSoft }, symbolText: { fontSize: 38, color: colors.text, fontWeight: '800' }, title: { color: colors.text, fontSize: 27, fontWeight: '800', textAlign: 'center' }, message: { color: colors.text, fontSize: 16, lineHeight: 23, textAlign: 'center' }, reference: { color: colors.primaryStrong, fontWeight: '800' }, category: { color: colors.mutedText }, notice: { color: colors.warning, backgroundColor: colors.warningSoft, padding: 12, borderRadius: 9, lineHeight: 19 }, button: { marginTop: 8, alignSelf: 'stretch', backgroundColor: colors.primary, borderRadius: 11, padding: 15, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '800' }, link: { padding: 10 }, linkText: { color: colors.primary, fontWeight: '700' } });
