// TokenCoin — coin-style visual for each token type

import { View, Text } from 'react-native';
import { TOKEN_META, type TokenType } from '@/services/prediction.service';
import { T } from '@/constants/theme';

const SYMBOLS: Record<TokenType, string> = {
  nullify:       '✕',
  double_points: '×2',
  bench_boost:   '▲',
};

interface TokenCoinProps {
  type: TokenType;
  size?: number;
  /** If provided, renders a small count badge at bottom-right */
  count?: number;
  /** Greyed-out (0 available / already used) */
  dimmed?: boolean;
}

export function TokenCoin({ type, size = 72, count, dimmed = false }: TokenCoinProps) {
  const meta  = TOKEN_META[type];
  const color = dimmed ? T.textMuted : meta.color;
  const border = Math.max(4, Math.round(size * 0.1));
  const faceSize = size - border * 2;

  const badgeSize   = Math.round(size * 0.38);
  const badgeRadius = Math.round(badgeSize / 2);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer ring / glow layer */}
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: dimmed ? 0.15 : 0.75,
        shadowRadius: size * 0.22,
        elevation: dimmed ? 3 : 16,
      }}>
        {/* Dark inner groove (the ring border look) */}
        <View style={{
          width: faceSize + 4, height: faceSize + 4,
          borderRadius: (faceSize + 4) / 2,
          backgroundColor: T.bg,
          justifyContent: 'center', alignItems: 'center',
        }}>
          {/* Main coin face */}
          <View style={{
            width: faceSize, height: faceSize, borderRadius: faceSize / 2,
            backgroundColor: T.bg,
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 1,
            borderColor: color + '50',
          }}>
            <Text style={{
              fontSize: Math.round(faceSize * (SYMBOLS[type].length > 1 ? 0.34 : 0.46)),
              color: color,
              fontWeight: '900',
              includeFontPadding: false,
              lineHeight: Math.round(faceSize * 0.54),
            }}>
              {SYMBOLS[type]}
            </Text>
          </View>
        </View>
      </View>

      {/* Count badge */}
      {count !== undefined && (
        <View style={{
          position: 'absolute',
          bottom: -1,
          right: -1,
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeRadius,
          backgroundColor: count > 0 ? color : T.bg,
          borderWidth: 2,
          borderColor: T.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: Math.max(9, Math.round(badgeSize * 0.44)),
            fontWeight: '900',
            color: '#fff',
            includeFontPadding: false,
          }}>
            {count}
          </Text>
        </View>
      )}
    </View>
  );
}
