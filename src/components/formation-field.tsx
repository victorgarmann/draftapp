import { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Line, Circle, Rect, Path } from 'react-native-svg';
import type { SquadPlayer } from '@/services/draft.service';
import type { Position } from '@/types/models';
import { T } from '@/constants/theme';
import { JerseyIcon } from '@/components/jersey-icon';

// ── Position groups ───────────────────────────────────────────────────────────

const DEF_POS: Position[] = ['CB', 'RB', 'LB'];
const MID_POS: Position[] = ['CM'];
const ATT_POS: Position[] = ['W', 'ST'];

const DEFAULT_COUNTS = { gk: 1, def: 4, mid: 3, att: 3 };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpotLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FormationFieldProps {
  starters: SquadPlayer[];
  showEmptySlots?: boolean;
  editing?: boolean;
  selectedId?: string | null;
  dropTargetId?: string | null;
  onPlayerPress?: (playerId: string) => void;
  onSpotMeasured?: (playerId: string, layout: SpotLayout) => void;
}

// ── Pitch markings (SVG) ──────────────────────────────────────────────────────

function PitchMarkings({ w, h }: { w: number; h: number }) {
  const lc  = 'rgba(255,255,255,0.90)';
  const lw  = 1.4;

  // Outer pitch border inset from field edge
  const pad = 7;
  const pw  = w - pad * 2;
  const ph  = h - pad * 2;
  const px  = pad;
  const py  = pad;

  const cx  = w / 2;
  const cy  = h / 2;

  // Center circle radius
  const cr  = pw * 0.145;

  // Corner arc radius
  const car = pw * 0.05;

  // Penalty box: 63% wide, 20% tall
  const pbW = pw * 0.63;
  const pbH = ph * 0.20;
  const pbX = cx - pbW / 2;

  // Goal box: 32% wide, 9% tall
  const gbW = pw * 0.32;
  const gbH = ph * 0.09;
  const gbX = cx - gbW / 2;

  // Penalty spot: 13% of pitch height from each goal line
  const psDist = ph * 0.13;
  const psTop  = py + psDist;
  const psBot  = py + ph - psDist;

  // D arc outside each penalty box
  function dArcPath(spotY: number, boxEdgeY: number, sweepDown: boolean): string {
    const dy = Math.abs(boxEdgeY - spotY);
    if (dy >= cr) return '';
    const dx = Math.sqrt(cr * cr - dy * dy);
    const x1 = cx - dx;
    const x2 = cx + dx;
    const sweep = sweepDown ? 1 : 0;
    return `M ${x1.toFixed(2)} ${boxEdgeY.toFixed(2)} A ${cr.toFixed(2)} ${cr.toFixed(2)} 0 0 ${sweep} ${x2.toFixed(2)} ${boxEdgeY.toFixed(2)}`;
  }

  const topPenBottom = py + pbH;
  const botPenTop    = py + ph - pbH;

  const topD = dArcPath(psTop, topPenBottom, true);
  const botD = dArcPath(psBot, botPenTop,    false);

  // Alternating vertical stripes (drawn behind everything)
  const numStripes = 8;
  const sw = w / numStripes;
  const stripes = Array.from({ length: numStripes }, (_, i) => ({ x: i * sw, light: i % 2 === 0 }));

  return (
    <Svg width={w} height={h}>
      {/* Stripes */}
      {stripes.map(({ x, light }) =>
        light ? <Rect key={x} x={x} y={0} width={sw} height={h} fill="rgba(255,255,255,0.07)" /> : null
      )}

      {/* Pitch outer border */}
      <Rect x={px} y={py} width={pw} height={ph} stroke={lc} strokeWidth={lw} fill="none" />

      {/* Corner arcs */}
      {/* top-left */}
      <Path d={`M ${px} ${py + car} A ${car} ${car} 0 0 1 ${px + car} ${py}`} stroke={lc} strokeWidth={lw} fill="none" />
      {/* top-right */}
      <Path d={`M ${px + pw - car} ${py} A ${car} ${car} 0 0 1 ${px + pw} ${py + car}`} stroke={lc} strokeWidth={lw} fill="none" />
      {/* bottom-right */}
      <Path d={`M ${px + pw} ${py + ph - car} A ${car} ${car} 0 0 1 ${px + pw - car} ${py + ph}`} stroke={lc} strokeWidth={lw} fill="none" />
      {/* bottom-left */}
      <Path d={`M ${px + car} ${py + ph} A ${car} ${car} 0 0 1 ${px} ${py + ph - car}`} stroke={lc} strokeWidth={lw} fill="none" />

      {/* Halfway line */}
      <Line x1={px} y1={cy} x2={px + pw} y2={cy} stroke={lc} strokeWidth={lw} />

      {/* Center circle + spot */}
      <Circle cx={cx} cy={cy} r={cr} stroke={lc} strokeWidth={lw} fill="none" />
      <Circle cx={cx} cy={cy} r={2.5} fill={lc} />

      {/* Top penalty box + goal box + spot + D */}
      <Rect x={pbX} y={py}          width={pbW} height={pbH} stroke={lc} strokeWidth={lw} fill="none" />
      <Rect x={gbX} y={py}          width={gbW} height={gbH} stroke={lc} strokeWidth={lw} fill="none" />
      <Circle cx={cx} cy={psTop} r={2.5} fill={lc} />
      {topD ? <Path d={topD} stroke={lc} strokeWidth={lw} fill="none" /> : null}

      {/* Bottom penalty box + goal box + spot + D */}
      <Rect x={pbX} y={py + ph - pbH} width={pbW} height={pbH} stroke={lc} strokeWidth={lw} fill="none" />
      <Rect x={gbX} y={py + ph - gbH} width={gbW} height={gbH} stroke={lc} strokeWidth={lw} fill="none" />
      <Circle cx={cx} cy={psBot} r={2.5} fill={lc} />
      {botD ? <Path d={botD} stroke={lc} strokeWidth={lw} fill="none" /> : null}
    </Svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FormationField({
  starters,
  showEmptySlots = false,
  editing = false,
  selectedId = null,
  dropTargetId = null,
  onPlayerPress,
  onSpotMeasured,
}: FormationFieldProps) {
  const [fieldSize, setFieldSize] = useState<{ w: number; h: number } | null>(null);

  const gk  = starters.filter((p) => p.playerPosition === 'GK');
  const def = starters.filter((p) => DEF_POS.includes(p.playerPosition));
  const mid = starters.filter((p) => MID_POS.includes(p.playerPosition));
  const att = starters.filter((p) => ATT_POS.includes(p.playerPosition));

  const gkRow  = buildRow(gk,  showEmptySlots ? DEFAULT_COUNTS.gk  : gk.length);
  const defRow = buildRow(def, showEmptySlots ? DEFAULT_COUNTS.def : def.length);
  const midRow = buildRow(mid, showEmptySlots ? DEFAULT_COUNTS.mid : mid.length);
  const attRow = buildRow(att, showEmptySlots ? DEFAULT_COUNTS.att : att.length);

  function spot(player: SquadPlayer | null, key: string) {
    return (
      <PlayerSpot
        key={key}
        player={player}
        editing={editing}
        selected={!!player && player.playerId === selectedId}
        isDropTarget={!!player && player.playerId === dropTargetId}
        onPress={player && (editing || onPlayerPress) ? () => onPlayerPress?.(player.playerId) : undefined}
        onMeasured={player && onSpotMeasured ? (layout) => onSpotMeasured(player.playerId, layout) : undefined}
      />
    );
  }

  return (
    <View style={styles.fieldOuter}>
      <View
        style={styles.pitch}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setFieldSize({ w: width, h: height });
        }}
      >
        {fieldSize && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <PitchMarkings w={fieldSize.w} h={fieldSize.h} />
          </View>
        )}

        {/* Att / Mid / Def — evenly spaced in upper portion */}
        <View style={styles.outfieldArea}>
          <View style={styles.row}>{attRow.map((p, i) => spot(p, `att-${i}`))}</View>
          <View style={styles.row}>{midRow.map((p, i) => spot(p, `mid-${i}`))}</View>
          <View style={styles.row}>{defRow.map((p, i) => spot(p, `def-${i}`))}</View>
        </View>

        {/* GK — sits lower near bottom goal line */}
        <View style={styles.gkArea}>
          <View style={styles.row}>{gkRow.map((p, i) => spot(p, `gk-${i}`))}</View>
        </View>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildRow(players: SquadPlayer[], count: number): (SquadPlayer | null)[] {
  const row: (SquadPlayer | null)[] = [...players];
  while (row.length < count) row.push(null);
  return row;
}

function PlayerSpot({
  player, editing, selected, isDropTarget, onPress, onMeasured,
}: {
  player: SquadPlayer | null;
  editing: boolean;
  selected: boolean;
  isDropTarget?: boolean;
  onPress?: () => void;
  onMeasured?: (layout: SpotLayout) => void;
}) {
  const spotRef = useRef<any>(null);
  const lastName = player ? player.playerName.split(' ').slice(-1)[0] : '';

  function handleLayout() {
    if (!player || !onMeasured) return;
    spotRef.current?.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
      onMeasured({ x: pageX, y: pageY, width, height });
    });
  }

  return (
    <TouchableOpacity
      ref={spotRef}
      style={[
        styles.spotWrap,
        selected && styles.spotSelected,
        isDropTarget && styles.spotDropTarget,
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      onLayout={handleLayout}
    >
      {player ? (
        <View style={styles.jerseyCircle}>
          <JerseyIcon teamName={player.playerTeam} isGK={player.playerPosition === 'GK'} size={34} />
        </View>
      ) : (
        <View style={styles.emptyCircle}>
          <Text style={styles.emptyPlus}>+</Text>
        </View>
      )}
      <View style={styles.nameTag}>
        <Text style={player ? styles.name : styles.nameEmpty}>
          {player ? lastName : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fieldOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#1a3a12',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },

  pitch: {
    backgroundColor: '#3d8c28',
    aspectRatio: 0.68,
    overflow: 'hidden',
  },

  outfieldArea: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingTop: 10,
    paddingHorizontal: 4,
  },

  gkArea: {
    paddingBottom: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },

  jerseyCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  spotWrap: {
    alignItems: 'center',
    width: 62,
    paddingVertical: 3,
    paddingHorizontal: 1,
    borderRadius: 8,
  },
  spotSelected: {
    backgroundColor: 'rgba(61,133,247,0.28)',
    borderWidth: 2,
    borderColor: T.accent,
  },
  spotDropTarget: {
    backgroundColor: 'rgba(76,175,80,0.28)',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },

  emptyCircle: {
    width: 32,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPlus: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.3)',
  },

  nameTag: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
    marginTop: 4,
    maxWidth: 62,
  },
  name: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Fredoka_700Bold',
    color: '#fff',
    textAlign: 'center',
  },
  nameEmpty: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});
