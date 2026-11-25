import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getStatusLabel } from '../constants/incidents';
import { colors } from '../theme/colors';
import { IncidentPriority, IncidentStatus } from '../types/incidents';

const STATUS_STYLES: Record<IncidentStatus, { background: string; text: string }> = {
  pending: { background: colors.warningSoft, text: colors.warning },
  acknowledged: { background: colors.infoSoft, text: colors.primary },
  assigned: { background: colors.infoSoft, text: colors.primary },
  escalated: { background: colors.dangerSoft, text: colors.danger },
  resolved: { background: colors.successSoft, text: colors.success },
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const palette = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{getStatusLabel(status)}</Text>
    </View>
  );
}

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  if (priority !== 'critical' && priority !== 'high') return null;
  return (
    <View style={[styles.badge, { backgroundColor: colors.dangerSoft }]}>
      <Text style={[styles.badgeText, { color: colors.danger }]}>
        {priority === 'critical' ? 'Critical' : 'High priority'}
      </Text>
    </View>
  );
}

export type SyncState = 'delivered' | 'pending' | 'syncing' | 'failed';

const SYNC_STYLES: Record<SyncState, { label: string; background: string; text: string }> = {
  delivered: { label: 'Received by server', background: colors.successSoft, text: colors.success },
  pending: { label: 'Saved on device \u2013 waiting to sync', background: colors.warningSoft, text: colors.warning },
  syncing: { label: 'Syncing with server...', background: colors.infoSoft, text: colors.primary },
  failed: { label: 'Saved on device \u2013 sync failed', background: colors.dangerSoft, text: colors.danger },
};

export function SyncBadge({ state }: { state: SyncState }) {
  const palette = SYNC_STYLES[state];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{palette.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
