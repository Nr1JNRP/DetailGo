// src/shared/components/Input.tsx
import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, spacing, radii, typography as T } from '@shared/theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
  touched?: boolean;
};

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  isPassword,
  containerStyle,
  touched,
  style,
  onBlur,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const showError = error && touched;
  const borderColor = showError
    ? colors.status.error
    : isFocused
    ? colors.primary.main
    : colors.border.main;

  const handleFocus = () => setIsFocused(true);

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  // 👇 FILTRA VALORES FALSY DO ARRAY
  const inputStyle = [
    styles.input,
    leftIcon ? styles.inputWithLeftIcon : null,
    isPassword || rightIcon ? styles.inputWithRightIcon : null,
    style,
  ].filter(Boolean);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.wrapper, { borderColor }]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={inputStyle}
          placeholderTextColor={colors.text.disabled}
          secureTextEntry={isPassword && !showPassword}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
          >
            {showPassword ? (
              <EyeOff size={20} color={colors.text.tertiary} />
            ) : (
              <Eye size={20} color={colors.text.tertiary} />
            )}
          </TouchableOpacity>
        )}

        {rightIcon && !isPassword && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>

      {showError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontFamily: T.family.semiBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: colors.background.surface,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  leftIcon: {
    paddingLeft: spacing.md,
  },
  rightIcon: {
    paddingRight: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: T.family.regular,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: spacing.xs,
  },
  errorText: {
    color: colors.status.error,
    fontSize: 12,
    fontFamily: T.family.medium,
    marginTop: spacing.xs,
    marginLeft: 4,
  },
});
