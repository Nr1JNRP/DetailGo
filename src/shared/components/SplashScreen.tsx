import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { darkColors, typography as T } from '@shared/theme';

const GridBackground = () => {
  const lines = Array.from({ length: 13 }, (_, index) => index * 8.333);

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="splashBase" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#070A0A" />
          <Stop offset="0.55" stopColor="#0A0D0C" />
          <Stop offset="1" stopColor="#050606" />
        </LinearGradient>
        <RadialGradient id="limeGlow" cx="75%" cy="18%" r="72%">
          <Stop offset="0" stopColor={darkColors.primary} stopOpacity="0.18" />
          <Stop offset="0.42" stopColor={darkColors.primary} stopOpacity="0.06" />
          <Stop offset="1" stopColor={darkColors.primary} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="warmGlow" cx="13%" cy="82%" r="42%">
          <Stop offset="0" stopColor={darkColors.accent} stopOpacity="0.12" />
          <Stop offset="1" stopColor={darkColors.accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect width="100%" height="100%" fill="url(#splashBase)" />
      <Rect width="100%" height="100%" fill="url(#limeGlow)" />
      <Rect width="100%" height="100%" fill="url(#warmGlow)" />

      <G opacity="0.08">
        {lines.map(position => (
          <Line
            key={`v-${position}`}
            x1={`${position}%`}
            y1="6%"
            x2={`${position}%`}
            y2="91%"
            stroke="#FFFFFF"
            strokeWidth="1"
          />
        ))}
        {lines.map(position => (
          <Line
            key={`h-${position}`}
            x1="0"
            y1={`${6 + position * 0.85}%`}
            x2="100%"
            y2={`${6 + position * 0.85}%`}
            stroke="#FFFFFF"
            strokeWidth="1"
          />
        ))}
      </G>
    </Svg>
  );
};

const SpeedDropLogo = () => (
  <View style={styles.symbolWrap}>
    <Svg width="174" height="174" viewBox="0 0 180 180">
      <Defs>
        <RadialGradient id="markGlow" cx="50%" cy="54%" r="58%">
          <Stop offset="0" stopColor={darkColors.primary} stopOpacity="0.22" />
          <Stop offset="1" stopColor={darkColors.primary} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="90" cy="100" r="78" fill="url(#markGlow)" />
      <G transform="translate(36 22)">
        <Path
          d="M54 4 C72 30 96 50 96 74a42 42 0 1 1-84 0C12 50 36 30 54 4Z"
          fill="rgba(212,255,61,0.06)"
          stroke={darkColors.primary}
          strokeWidth="3.8"
        />
        <Path
          d="M40 50C32 60 28 74 32 88"
          stroke={darkColors.primary}
          strokeWidth="4.2"
          strokeLinecap="round"
          fill="none"
        />
        <G stroke={darkColors.primary} strokeLinecap="round">
          <Line x1="14" y1="78" x2="40" y2="78" strokeWidth="4" />
          <Line x1="6" y1="90" x2="32" y2="90" strokeWidth="3.3" opacity="0.78" />
          <Line x1="18" y1="102" x2="36" y2="102" strokeWidth="2.8" opacity="0.58" />
        </G>
      </G>
    </Svg>
  </View>
);

export const SplashScreen = () => (
  <View style={styles.container}>
    <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
    <GridBackground />

    <View style={styles.brandBlock}>
      <SpeedDropLogo />
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmark}>DETAIL</Text>
        <View style={styles.dot} />
        <Text style={styles.wordmark}>GO</Text>
      </View>
      <Text style={styles.tagline}>
        Plataforma de gestão e agendamento para serviços de estética automotiva.
      </Text>
    </View>

    <View style={styles.footer}>
      <View style={styles.loader} />
      <Text style={styles.version}>v 2.0 - BUILD 2026.04</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050606',
    overflow: 'hidden',
  },
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 72,
  },
  symbolWrap: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  wordmark: {
    color: darkColors.ink,
    fontSize: 46,
    fontFamily: T.family.extraBold,
    letterSpacing: 0,
    lineHeight: 54,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: darkColors.primary,
    marginHorizontal: 5,
    transform: [{ translateY: -3 }],
  },
  tagline: {
    color: darkColors.ink2,
    fontFamily: T.family.medium,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0,
    marginTop: 28,
    maxWidth: 312,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 74,
    alignItems: 'center',
  },
  loader: {
    width: 240,
    height: 4,
    borderRadius: 2,
    backgroundColor: darkColors.primary,
    marginBottom: 30,
  },
  version: {
    color: 'rgba(255,255,255,0.34)',
    fontFamily: T.family.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
});
