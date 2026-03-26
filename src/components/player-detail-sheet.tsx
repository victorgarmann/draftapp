import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { JerseyIcon } from '@/components/jersey-icon';
import { MATCHDAY_SCHEDULE, type PlayerRating } from '@/services/rating.service';
import { T } from '@/constants/theme';
import type { Player } from '@/types/models';

export interface PlayerDetailSheetProps {
  player: Player | null;
  ratings: PlayerRating[];
  loading: boolean;
  ownerUsername?: string | null;
  onClose: () => void;
}

export function PlayerDetailSheet({
  player,
  ratings,
  loading,
  ownerUsername,
  onClose,
}: PlayerDetailSheetProps) {
  const col = player ? T.positions[player.position] : T.accent;
  const totalPts = ratings.reduce((sum, r) => sum + (r.points ?? 0), 0);
  const played = ratings.filter((r) => !r.didNotPlay).length;
  const avgPts = played > 0 ? (totalPts / played).toFixed(1) : '—';

  return (
    <Modal visible={!!player} transparent animationType="slide">
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          <View style={s.handle} />

          {player && (
            <>
              {/* Header */}
              <View style={s.header}>
                <JerseyIcon
                  teamName={player.teamName}
                  isGK={player.position === 'GK'}
                  size={60}
                />
                <View style={s.headerInfo}>
                  <Text style={s.name}>{player.name}</Text>
                  <Text style={s.team}>{player.teamName}</Text>
                  {ownerUsername && (
                    <Text style={s.ownerBadge}>Owned by {ownerUsername}</Text>
                  )}
                </View>
                <View style={[s.posBadge, { backgroundColor: col + '28' }]}>
                  <Text style={[s.posText, { color: col }]}>{player.position}</Text>
                </View>
              </View>

              {/* Stats */}
              <View style={s.stats}>
                <View style={s.stat}>
                  <Text style={s.statVal}>{totalPts}</Text>
                  <Text style={s.statLabel}>Total pts</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={s.statVal}>{played}</Text>
                  <Text style={s.statLabel}>Games played</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={s.statVal}>{avgPts}</Text>
                  <Text style={s.statLabel}>Avg pts/game</Text>
                </View>
              </View>

              <Text style={s.fotmobCredit}>Ratings powered by FotMob</Text>

              {/* Rating history */}
              <Text style={s.sectionLabel}>MATCHDAY HISTORY</Text>
              {loading ? (
                <ActivityIndicator color={T.accent} style={{ marginTop: 20 }} />
              ) : ratings.length === 0 ? (
                <Text style={s.empty}>No ratings yet — data appears after matchdays are played.</Text>
              ) : (
                <ScrollView style={s.ratingList} showsVerticalScrollIndicator={false}>
                  {MATCHDAY_SCHEDULE.filter((md) => new Date(md.date) < new Date()).map((md) => {
                    const r = ratings.find((x) => x.matchday === md.matchday);
                    if (!r) return null;
                    return (
                      <View key={md.matchday} style={s.ratingRow}>
                        <View style={s.mdBadge}>
                          <Text style={s.mdText}>MD{md.matchday}</Text>
                        </View>
                        <Text style={s.mdLabel} numberOfLines={1}>{md.label}</Text>
                        <View style={s.ratingRight}>
                          {r.didNotPlay ? (
                            <Text style={s.dnp}>DNP</Text>
                          ) : (
                            <>
                              <Text style={s.ratingScore}>{r.fotmobRating?.toFixed(1)}</Text>
                              <Text style={s.ratingPts}>{r.points > 0 ? `+${r.points}` : r.points} pts</Text>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 44, maxHeight: '85%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 18 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  headerInfo: { flex: 1 },
  name:  { fontSize: 17, fontWeight: '800', fontFamily: 'Fredoka_700Bold', color: T.text },
  team:  { fontSize: 13, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, marginTop: 2 },
  ownerBadge: { fontSize: 12, color: T.accent, fontWeight: '600', fontFamily: 'Fredoka_500Medium', marginTop: 4 },
  posBadge: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  posText:  { fontSize: 13, fontWeight: '800', fontFamily: 'Fredoka_700Bold' },

  stats: {
    flexDirection: 'row', backgroundColor: T.surface, borderRadius: 16,
    padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.glassBorder,
  },
  stat:         { flex: 1, alignItems: 'center' },
  statVal:      { fontSize: 22, fontWeight: '800', fontFamily: 'Fredoka_700Bold', color: T.text },
  statLabel:    { fontSize: 10, fontFamily: 'Fredoka_500Medium', color: T.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider:  { width: 1, backgroundColor: T.border, marginVertical: 2 },

  sectionLabel: { fontSize: 10, fontWeight: '700', fontFamily: 'Fredoka_700Bold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  empty:        { fontSize: 13, fontFamily: 'Fredoka_500Medium', color: T.textMuted, textAlign: 'center', paddingVertical: 20 },
  ratingList:   { maxHeight: 280 },

  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  mdBadge:     { backgroundColor: T.accent + '22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, minWidth: 36, alignItems: 'center' },
  mdText:      { fontSize: 11, fontWeight: '700', fontFamily: 'Fredoka_700Bold', color: T.accent },
  mdLabel:     { flex: 1, fontSize: 12, fontFamily: 'Fredoka_500Medium', color: T.textSecondary },
  ratingRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingScore: { fontSize: 15, fontWeight: '700', fontFamily: 'Fredoka_700Bold', color: T.text },
  ratingPts:   { fontSize: 13, fontWeight: '600', fontFamily: 'Fredoka_500Medium', color: T.success, minWidth: 44, textAlign: 'right' },
  dnp:         { fontSize: 12, fontFamily: 'Fredoka_500Medium', color: T.textMuted, fontStyle: 'italic' },
  fotmobCredit: { fontSize: 10, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 8 },
});
