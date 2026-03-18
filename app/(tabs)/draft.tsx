import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { getMyGroups, type GroupDetail } from '@/services/group.service';
import { SkeletonBox, SkeletonText } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';
import { T, R } from '@/constants/theme';

export default function DraftScreen() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const g = await getMyGroups(user.uid);
      setGroups(g);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const active = groups.filter((g) => g.draftStatus === 'in_progress');
  const pending = groups.filter((g) => g.draftStatus === 'pending');
  const completed = groups.filter((g) => g.draftStatus === 'completed');

  if (loading) {
    return (
      <GradientScreen>
        <View style={{ padding: 16, gap: 10 }}>
          <SkeletonText style={{ width: 60, height: 10 }} />
          <SkeletonBox style={{ height: 100, borderRadius: R.card }} />
          <SkeletonText style={{ width: 80, height: 10, marginTop: 4 }} />
          <SkeletonBox style={{ height: 72, borderRadius: R.card }} />
          <SkeletonBox style={{ height: 72, borderRadius: R.card }} />
        </View>
      </GradientScreen>
    );
  }

  if (groups.length === 0) {
    return (
      <GradientScreen style={styles.center}>
        <EmptyState
          icon="clipboard-outline"
          title="No drafts yet"
          subtitle="Create or join a group from the Home tab to get started."
        />
      </GradientScreen>
    );
  }

  return (
    <GradientScreen>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={T.accent} />}
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Active drafts */}
            {active.length > 0 && (
              <>
                <SectionHeader title="Live Now" accent />
                {active.map((g) => (
                  <ActiveCard key={g.id} group={g} />
                ))}
              </>
            )}

            {/* Pending drafts */}
            {pending.length > 0 && (
              <>
                <SectionHeader title="Upcoming" />
                {pending.map((g) => (
                  <PendingCard key={g.id} group={g} />
                ))}
              </>
            )}

            {/* Completed drafts */}
            {completed.length > 0 && (
              <>
                <SectionHeader title="Completed" />
                {completed.map((g) => (
                  <CompletedCard key={g.id} group={g} />
                ))}
              </>
            )}
          </>
        }
      />
    </GradientScreen>
  );
}

function SectionHeader({ title, accent }: { title: string; accent?: boolean }) {
  return (
    <Text style={[styles.sectionTitle, accent && styles.sectionTitleAccent]}>{title}</Text>
  );
}

function ActiveCard({ group }: { group: GroupDetail }) {
  return (
    <GlassCard style={styles.activeCard}>
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>
      <Text style={styles.activeGroupName}>{group.name}</Text>
      <Text style={styles.activeMembers}>{group.memberCount} managers · {group.draftOrderMode === 'random' ? 'Random order' : 'Manual order'}</Text>
      <TouchableOpacity
        style={styles.joinBtn}
        onPress={() => router.push(`/draft/${group.id}`)}
      >
        <Text style={styles.joinBtnText}>Go to Draft Board</Text>
      </TouchableOpacity>
    </GlassCard>
  );
}

function PendingCard({ group }: { group: GroupDetail }) {
  return (
    <TouchableOpacity onPress={() => router.push(`/group/${group.id}`)}>
      <GlassCard style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardName}>{group.name}</Text>
          <Text style={styles.cardSub}>
            {group.memberCount}/{group.maxMembers} members · {group.draftDate ? `Scheduled ${formatDate(group.draftDate)}` : 'No date set'}
          </Text>
        </View>
        <Text style={styles.cardChevron}>›</Text>
      </GlassCard>
    </TouchableOpacity>
  );
}

function CompletedCard({ group }: { group: GroupDetail }) {
  return (
    <TouchableOpacity onPress={() => router.push(`/group/${group.id}`)}>
      <GlassCard style={[styles.card, styles.cardMuted]}>
        <View style={styles.cardLeft}>
          <Text style={[styles.cardName, styles.cardNameMuted]}>{group.name}</Text>
          <Text style={styles.cardSub}>{group.memberCount} managers · Draft complete</Text>
        </View>
        <Text style={styles.cardChevron}>›</Text>
      </GlassCard>
    </TouchableOpacity>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 10, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 12, fontFamily: 'Fredoka_500Medium', color: T.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 4,
  },
  sectionTitleAccent: { color: T.accent },

  activeCard: {
    borderColor: T.accent,
    gap: 6,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.error },
  liveBadge: {
    backgroundColor: T.error,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveText: { fontSize: 11, fontFamily: 'Fredoka_700Bold', color: '#fff', letterSpacing: 1 },
  activeGroupName: { fontSize: 20, fontFamily: 'Fredoka_700Bold', color: T.text },
  activeMembers: { fontSize: 13, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, marginBottom: 8 },
  joinBtn: {
    backgroundColor: T.accent,
    borderRadius: R.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  joinBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Fredoka_600SemiBold' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.card,
    padding: 16,
    borderColor: T.glassBorder,
  },
  cardMuted: { opacity: 0.6 },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 15, fontFamily: 'Fredoka_600SemiBold', color: T.text, marginBottom: 3 },
  cardNameMuted: { color: T.textSecondary },
  cardSub: { fontSize: 13, fontFamily: 'Fredoka_500Medium', color: T.textSecondary },
  cardChevron: { fontSize: 22, color: T.textMuted, marginLeft: 8 },
});
