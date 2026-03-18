// Profile service — cross-group stats for the profile screen

import { supabase } from '@/lib/supabase';

export interface ProfileStats {
  totalPoints: number;
  groupCount: number;
  predictionsCorrect: number;
  predictionsTotal: number;
  tokensEarned: number;
  tokensUsed: number;
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [memberships, predictions, tokens] = await Promise.all([
    supabase.from('group_members').select('total_points').eq('user_id', userId),
    supabase.from('predictions').select('is_correct').eq('user_id', userId),
    supabase.from('tokens').select('used_matchday').eq('user_id', userId),
  ]);

  const totalPoints = (memberships.data ?? []).reduce(
    (sum: number, m: any) => sum + (m.total_points ?? 0), 0,
  );
  const groupCount       = (memberships.data ?? []).length;
  const predictionsTotal = (predictions.data ?? []).length;
  const predictionsCorrect = (predictions.data ?? []).filter((p: any) => p.is_correct).length;
  const tokensEarned = (tokens.data ?? []).length;
  const tokensUsed   = (tokens.data ?? []).filter((t: any) => t.used_matchday !== null).length;

  return { totalPoints, groupCount, predictionsCorrect, predictionsTotal, tokensEarned, tokensUsed };
}
