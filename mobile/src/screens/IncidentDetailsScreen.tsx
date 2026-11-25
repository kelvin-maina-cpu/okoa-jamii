import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { getIncident } from '../services/incidentApi';
import { getQueuedIncident } from '../services/incidentQueue';
import { IncidentRecord, QueuedIncident } from '../types/incidents';
import { getCategoryLabel } from '../constants/incidents';
import { formatDateTime } from '../utils/format';
import { StatusBadge, SyncBadge } from '../components/StatusBadge';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'IncidentDetails'>;
export function IncidentDetailsScreen({ route, navigation }: Props) {
  const { tokens } = useAuth();
  const [incident, setIncident] = useState<IncidentRecord | null>(null);
  const [local, setLocal] = useState<QueuedIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (route.params.localId) {
          const item = await getQueuedIncident(route.params.localId);
          if (active) setLocal(item);
        } else if (route.params.incidentId && tokens) {
          const result = await getIncident(route.params.incidentId, tokens.accessToken);
          if (active) setIncident(result.incident);
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load details.'); }
      finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [route.params.incidentId, route.params.localId, tokens]);
  const type = incident?.incidentType ?? local?.payload.incidentType;
  const location = incident?.addressOrArea ?? local?.payload.addressOrArea ?? (incident?.location ? `${incident.location.latitude}, ${incident.location.longitude}` : local?.payload.location ? `${local.payload.location.latitude}, ${local.payload.location.longitude}` : 'Not recorded');
  return <ScrollView contentContainerStyle={styles.container}>
    <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}><Text style={styles.back}>‹  Back</Text></Pressable>
    <Text style={styles.title}>Report details</Text>
    {loading && <ActivityIndicator color={colors.primary} />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {incident && <><View style={styles.row}><Text style={styles.category}>{getCategoryLabel(incident.incidentType)}</Text><StatusBadge status={incident.status} /></View><Text style={styles.meta}>{incident.reference} · Submitted {formatDateTime(incident.createdAt)}</Text><View style={{ marginTop: 10 }}><SyncBadge state="delivered" /></View></>}
    {local && <><Text style={styles.category}>{getCategoryLabel(local.payload.incidentType)}</Text><Text style={styles.meta}>Local reference {local.localId}</Text><View style={{ marginTop: 10 }}><SyncBadge state={local.syncState === 'failed' ? 'failed' : 'pending'} /></View><Text style={styles.warning}>This report is stored on this device. It has not been received by the server.</Text></>}
    {type && <><Text style={styles.label}>Description</Text><Text style={styles.body}>{incident?.description ?? local?.payload.description}</Text><Text style={styles.label}>Location</Text><Text style={styles.body}>{location}</Text><Text style={styles.label}>Reported time</Text><Text style={styles.body}>{formatDateTime(incident?.occurredAt ?? local?.payload.occurredAt)}</Text></>}
    {!!incident?.statusHistory.length && <><Text style={styles.label}>Status history</Text>{incident.statusHistory.map((entry, index) => <View key={`${entry.status}-${entry.at}-${index}`} style={styles.history}><StatusBadge status={entry.status} /><Text style={styles.meta}>{formatDateTime(entry.at)}</Text>{!!entry.note && <Text style={styles.body}>{entry.note}</Text>}</View>)}</>}
    {local?.lastError && <Text style={styles.error}>{local.lastError}</Text>}
  </ScrollView>;
}
const styles = StyleSheet.create({ container: { flexGrow: 1, backgroundColor: colors.background, padding: 22, paddingTop: 48, gap: 13 }, back: { color: colors.primary, fontSize: 16, fontWeight: '700' }, title: { fontSize: 27, color: colors.text, fontWeight: '800' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, category: { color: colors.text, fontWeight: '800', fontSize: 18, flex: 1 }, meta: { color: colors.mutedText, fontSize: 13, marginTop: 5 }, label: { color: colors.text, fontWeight: '800', marginTop: 8 }, body: { color: colors.text, fontSize: 15, lineHeight: 21 }, history: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, gap: 5 }, warning: { color: colors.warning, backgroundColor: colors.warningSoft, padding: 12, borderRadius: 9 }, error: { color: colors.danger } });
