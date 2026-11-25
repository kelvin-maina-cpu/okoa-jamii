import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { getMyIncidents } from '../services/incidentApi';
import { countUnownedLegacyIncidents, listIncidents } from '../services/incidentQueue';
import { subscribeToIncidentSync, syncQueuedIncidents } from '../services/incidentSync';
import { IncidentRecord, IncidentListResponse, QueuedIncident } from '../types/incidents';
import { getCategoryLabel } from '../constants/incidents';
import { formatDateTime } from '../utils/format';
import { StatusBadge, SyncBadge } from '../components/StatusBadge';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MyReports'>;
export function MyReportsScreen({ navigation }: Props) {
  const { tokens, user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [queued, setQueued] = useState<QueuedIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [unownedLegacyCount, setUnownedLegacyCount] = useState(0);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const local = user ? await listIncidents(user.id).catch(() => []) : [];
    setQueued(local);
    setUnownedLegacyCount(await countUnownedLegacyIncidents().catch(() => 0));
    if (tokens) {
      try { const result = await getMyIncidents(tokens.accessToken); setIncidents(result.incidents); setPage(result.pagination.page); setHasMore(result.pagination.hasMore); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load reports.'); }
    }
    setLoading(false);
  }, [tokens, user]);
  const loadMore = async () => {
    if (!tokens || !hasMore || loading) return;
    setLoading(true);
    try { const result: IncidentListResponse = await getMyIncidents(tokens.accessToken, page + 1); setIncidents((current) => [...current, ...result.incidents]); setPage(result.pagination.page); setHasMore(result.pagination.hasMore); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load more reports.'); }
    finally { setLoading(false); }
  };
  const sync = async () => {
    if (!tokens || !user || syncing) return;
    setSyncing(true);
    try { await syncQueuedIncidents(tokens.accessToken, user.id, { manual: true }); await load(); }
    finally { setSyncing(false); }
  };
  useFocusEffect(useCallback(() => {
    void load();
    return subscribeToIncidentSync(() => { void load(); });
  }, [load]));
  const visibleLocal = queued.filter((item) => item.syncStatus !== 'synced' || !incidents.some((server) => server.id === item.serverIncidentId));

  return <ScrollView contentContainerStyle={styles.container}>
    <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}><Text style={styles.refreshText}>‹  Back</Text></Pressable>
    <Text style={styles.title}>My reports</Text>
    {loading && <ActivityIndicator color={colors.primary} />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {unownedLegacyCount > 0 && <Text style={styles.legacyNotice}>{unownedLegacyCount} report(s) saved by an older app version are preserved on this device but have no account association, so they will not sync automatically. Keep this app data and contact your project administrator for recovery.</Text>}
    {visibleLocal.map((item) => <Pressable key={item.localId} onPress={() => navigation.navigate('IncidentDetails', { localId: item.localId })} style={styles.card}>
      <View style={styles.row}><Text style={styles.category}>{getCategoryLabel(item.payload.incidentType)}</Text><SyncBadge state={item.syncStatus === 'synced' ? 'delivered' : item.syncStatus === 'failed' ? 'failed' : item.syncStatus === 'syncing' ? 'syncing' : 'pending'} /></View>
      <Text style={styles.meta}>{item.serverIncidentId ? `Server ID ${item.serverIncidentId}` : 'Local reference pending'} · Saved {formatDateTime(item.createdAt)} · {item.retryCount} attempts</Text>
      {!!item.lastAttemptAt && <Text style={styles.meta}>Last attempt {formatDateTime(item.lastAttemptAt)}</Text>}
      {!!item.errorMessage && <Text style={styles.error}>{item.errorMessage}</Text>}
      <Text numberOfLines={2} style={styles.description}>{item.payload.addressOrArea ?? (item.payload.location ? `${item.payload.location.latitude.toFixed(4)}, ${item.payload.location.longitude.toFixed(4)}` : 'Location not available')}</Text>
    </Pressable>)}
    {incidents.map((item) => <Pressable key={item.id} onPress={() => navigation.navigate('IncidentDetails', { incidentId: item.id })} style={styles.card}>
      <View style={styles.row}><Text style={styles.category}>{getCategoryLabel(item.incidentType)}</Text><StatusBadge status={item.status} /></View>
      <Text style={styles.meta}>{item.reference} · {formatDateTime(item.createdAt)}</Text>
      <Text style={styles.description}>{item.addressOrArea ?? (item.location ? `${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)}` : 'Location unavailable')}</Text>
      <View style={{ marginTop: 8 }}><SyncBadge state="delivered" /></View>
    </Pressable>)}
    {hasMore && <Pressable style={styles.refresh} onPress={() => void loadMore()}><Text style={styles.refreshText}>Load more reports</Text></Pressable>}
    {!loading && !error && !visibleLocal.length && !incidents.length && <Text style={styles.empty}>No reports yet. Use “Report an incident” to get started.</Text>}
    <Pressable style={styles.button} onPress={() => navigation.navigate('ReportIncident')}><Text style={styles.buttonText}>Report an incident</Text></Pressable>
    {queued.some((item) => item.syncStatus !== 'synced') && <Pressable style={styles.refresh} onPress={() => void sync()}><Text style={styles.refreshText}>{syncing ? 'Syncing…' : 'Try syncing saved reports'}</Text></Pressable>}
    <Pressable style={styles.refresh} onPress={() => void load()}><Text style={styles.refreshText}>Refresh reports</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: 22, paddingTop: 48, gap: 12 }, title: { color: colors.text, fontSize: 27, fontWeight: '800', marginBottom: 4 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, category: { color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }, meta: { color: colors.mutedText, fontSize: 12, marginTop: 9 }, description: { color: colors.text, fontSize: 14, marginTop: 7 }, empty: { textAlign: 'center', color: colors.mutedText, marginVertical: 24 }, error: { color: colors.danger },
  button: { backgroundColor: colors.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 8 }, buttonText: { color: '#fff', fontWeight: '800' }, refresh: { alignItems: 'center', padding: 10 }, refreshText: { color: colors.primary, fontWeight: '700' }, legacyNotice: { backgroundColor: colors.warningSoft, color: colors.warning, padding: 12, borderRadius: 9, fontSize: 13, lineHeight: 19 },
});
