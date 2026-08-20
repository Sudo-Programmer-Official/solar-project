export function formatSolarAnalysisProgress(analyzedCount: number, targetCount: number): string {
  const analyzed = Number.isFinite(analyzedCount) ? Math.max(0, Math.floor(analyzedCount)) : 0;
  const target = Number.isFinite(targetCount) ? Math.max(0, Math.floor(targetCount)) : 0;
  if (target > 0) {
    return `${analyzed} of ${target} analyzed`;
  }
  return `${analyzed} properties analyzed`;
}
