// src/shared/components/SelectModal.tsx
import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { spacing, radii, typography as T, useAppTheme, type AppColors } from '@shared/theme';

function OptionSeparator() {
  return <View style={{ height: spacing.sm }} />;
}

type Option<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  title: string;
  visible: boolean;
  value: T | null;
  options: Option<T>[];
  onClose: () => void;
  onSelect: (v: T) => void;
};

export default function SelectModal<T extends string>({
  title,
  visible,
  value,
  options,
  onClose,
  onSelect,
}: Props<T>) {
  const { colors: D } = useAppTheme();
  const styles = useMemo(() => createStyles(D), [D]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>

            <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.close}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={options}
            keyExtractor={it => it.value}
            ItemSeparatorComponent={OptionSeparator}
            contentContainerStyle={{ paddingBottom: spacing.lg }}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <TouchableOpacity
                  style={[styles.item, selected && styles.itemSelected]}
                  onPress={() => {
                    onSelect(item.value);
                    onClose();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.itemText, selected && styles.itemTextSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function createStyles(D: AppColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: D.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: D.bg,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      maxHeight: '72%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 16,
      fontFamily: T.family.extraBold,
      color: D.ink,
    },
    close: {
      fontSize: 14,
      fontFamily: T.family.extraBold,
      color: D.primary,
    },

    item: {
      borderWidth: 1,
      borderColor: D.border,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: D.card,
    },
    itemSelected: {
      backgroundColor: D.primary,
      borderColor: D.primary,
    },
    itemText: {
      color: D.ink,
      fontFamily: T.family.extraBold,
    },
    itemTextSelected: {
      color: D.onPrimary,
    },
  });
}
