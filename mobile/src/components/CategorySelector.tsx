import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { INCIDENT_CATEGORIES } from '../constants/incidents';
import { colors } from '../theme/colors';
import { IncidentType } from '../types/incidents';

interface Props {
  value: IncidentType | null;
  onChange: (value: IncidentType) => void;
  disabled?: boolean;
  label?: string;
}

export function CategorySelector({ value, onChange, disabled = false, label = 'Emergency category' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {INCIDENT_CATEGORIES.map((category) => {
          const selected = value === category.value;
          return (
            <Pressable
              key={category.value}
              onPress={() => onChange(category.value)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={category.label}
              style={[styles.option, selected && styles.optionSelected, disabled && styles.optionDisabled]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{category.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  optionTextSelected: {
    color: '#fff',
  },
});
