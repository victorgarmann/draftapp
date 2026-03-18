import { useState } from 'react';
import { Image, View, Text } from 'react-native';
import { findClub } from '@/constants/clubs';
import { T } from '@/constants/theme';

// Replaced SVG jersey with country flag image for WC 2026.
// isGK prop kept for API compatibility but no longer affects rendering.
export function JerseyIcon({
  teamName,
  isGK = false,
  size = 48,
}: {
  teamName: string;
  isGK?: boolean;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const club = findClub(teamName);
  const url = club?.logoUrl;

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }

  // Fallback: 3-letter country code in a circle
  const label = club?.shortName ?? teamName.slice(0, 3).toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: T.surface2,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ fontSize: size * 0.28, fontFamily: 'Fredoka_700Bold', color: T.textSecondary }}>
        {label}
      </Text>
    </View>
  );
}
