export const RATING_BASELINE = 6.0;

export function calculatePoints(fotmobRating: number | null): number {
  if (fotmobRating === null) return 0;
  return Math.round((fotmobRating - RATING_BASELINE) * 10) / 10;
}
