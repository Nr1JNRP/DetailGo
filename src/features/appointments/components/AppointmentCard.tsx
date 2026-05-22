import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, radii, typography as T } from '@shared/theme';
import { dateUtils } from '@shared/utils/date.utils';
import { formatUtils } from '@shared/utils/format.utils';
import { getAppointmentStatusConfig } from '../domain/appointment.helpers';
import { UserAppointment } from '../domain/appointment.types';

type Props = {
  item: UserAppointment;
};

export default function AppointmentCard({ item }: Props) {
  const subtitle =
    item.vehicleType === 'Carro' && item.carCategory
      ? `Carro • ${item.carCategory}`
      : item.vehicleType;

  const statusConfig = getAppointmentStatusConfig(item.status);

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.serviceLabel ?? 'Serviço'}
        </Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
        <Text style={[styles.status, { color: statusConfig.color }]}>{statusConfig.label}</Text>
      </View>

      <View style={styles.cardRight}>
        <Text style={styles.cardPrice}>+{formatUtils.currencyCompact(item.price)}</Text>
        <Text style={styles.cardDate}>
          {dateUtils.formatDate(item.startAtMs)} • {dateUtils.formatHour(item.startAtMs)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.main,
  },
  cardLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardRight: {
    alignItems: 'flex-end',
  },

  cardTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: T.family.bold,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    color: colors.text.tertiary,
    fontSize: 14,
    fontFamily: T.family.regular,
    marginBottom: spacing.xs,
  },
  status: {
    fontFamily: T.family.semiBold,
    fontSize: 13,
  },

  cardPrice: {
    color: colors.primary.main,
    fontSize: 16,
    fontFamily: T.family.bold,
    marginBottom: spacing.xs,
  },
  cardDate: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontFamily: T.family.regular,
  },
});
