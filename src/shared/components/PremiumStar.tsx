import React from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type Props = {
  size?: number;
  /** Usa a variante clara do ícone (para tema light). */
  light?: boolean;
};

/**
 * Ícone premium do DetailGo — reprodução fiel dos assets
 * `icon-premium-star-badge.svg` (escuro) e
 * `icon-premium-star-badge-light.svg` (claro). Indica que o
 * owner possui a versão paga (assinatura ativa).
 */
export default function PremiumStar({ size = 16, light = false }: Props) {
  if (light) {
    return (
      <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
        <Defs>
          <LinearGradient id="goldDL" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#D9AF52" />
            <Stop offset="0.5" stopColor="#C89B3C" />
            <Stop offset="1" stopColor="#A87E22" />
          </LinearGradient>
          <LinearGradient id="bgL" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#F4F1E8" />
          </LinearGradient>
          <LinearGradient id="starBgL" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#D9AF52" />
            <Stop offset="1" stopColor="#A87E22" />
          </LinearGradient>
        </Defs>

        <Rect width={1024} height={1024} rx={230} fill="url(#bgL)" />
        <Rect
          x={8}
          y={8}
          width={1008}
          height={1008}
          rx={224}
          fill="none"
          stroke="#C89B3C"
          strokeOpacity={0.3}
          strokeWidth={3}
        />

        <G
          transform="translate(104 144) scale(8)"
          stroke="url(#goldDL)"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M24 18 H46 a32 32 0 0 1 0 64 H24" strokeWidth={13} />
          <Line x1={24} y1={50} x2={42} y2={50} strokeWidth={13} />
          <Path d="M52 38 L64 50 L52 62" strokeWidth={9} />
        </G>

        <G transform="translate(782 242)">
          <Circle r={158} fill="url(#bgL)" />
          <Circle r={150} fill="url(#starBgL)" />
          <Path
            d="M0 -82 L21 -23 L84 -23 L34 17 L52 78 L0 41 L-52 78 L-34 17 L-84 -23 L-21 -23 Z"
            fill="#FFFFFF"
          />
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
      <Defs>
        <LinearGradient id="goldD" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F4DD9A" />
          <Stop offset="0.5" stopColor="#E8C66B" />
          <Stop offset="1" stopColor="#C89B3C" />
        </LinearGradient>
        <LinearGradient id="bgD" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#16181A" />
          <Stop offset="1" stopColor="#050607" />
        </LinearGradient>
        <LinearGradient id="starBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F4DD9A" />
          <Stop offset="1" stopColor="#C89B3C" />
        </LinearGradient>
      </Defs>

      <Rect width={1024} height={1024} rx={230} fill="url(#bgD)" />
      <Rect
        x={8}
        y={8}
        width={1008}
        height={1008}
        rx={224}
        fill="none"
        stroke="#E8C66B"
        strokeOpacity={0.3}
        strokeWidth={3}
      />

      <G
        transform="translate(104 144) scale(8)"
        stroke="url(#goldD)"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M24 18 H46 a32 32 0 0 1 0 64 H24" strokeWidth={13} />
        <Line x1={24} y1={50} x2={42} y2={50} strokeWidth={13} />
        <Path d="M52 38 L64 50 L52 62" strokeWidth={9} />
      </G>

      <G transform="translate(782 242)">
        <Circle r={158} fill="url(#bgD)" />
        <Circle r={150} fill="url(#starBg)" />
        <Path
          d="M0 -82 L21 -23 L84 -23 L34 17 L52 78 L0 41 L-52 78 L-34 17 L-84 -23 L-21 -23 Z"
          fill="#0B0D0E"
        />
      </G>
    </Svg>
  );
}
