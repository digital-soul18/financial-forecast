import { format, addMonths, startOfMonth } from 'date-fns';
import type { ForecastPoint, ForecastResult, MonthlyTotal } from '@/types/forecast';

const WEIGHTS = [0.5, 0.3, 0.2]; // most recent first

function weightedAvg(values: number[]): number {
  if (values.length === 0) return 0;
  const usable = values.slice(0, 3);
  const weights = WEIGHTS.slice(0, usable.length);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return usable.reduce((sum, v, i) => sum + v * (weights[i] / weightSum), 0);
}

function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (values[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeForecast(
  monthlyTotals: MonthlyTotal[],
  horizonMonths: number,
  currentBalance: number,
): ForecastResult {
  // Group by category → sorted months
  const byCategory: Record<string, Record<string, number>> = {};
  for (const t of monthlyTotals) {
    if (!byCategory[t.category]) byCategory[t.category] = {};
    byCategory[t.category][t.month] = t.total;
  }

  // Find all historical months sorted
  const allMonths = [...new Set(monthlyTotals.map(t => t.month))].sort();
  const lastMonth = allMonths[allMonths.length - 1] ?? format(new Date(), 'yyyy-MM');

  const points: ForecastPoint[] = [];

  // Include actual points
  for (const month of allMonths) {
    for (const category of Object.keys(byCategory)) {
      const total = byCategory[category][month] ?? 0;
      if (total === 0) continue;
      points.push({ month, category, projectedAmount: total, lowerBound: total, upperBound: total, isActual: true });
    }
  }

  // Project future months
  let totalProjectedExpenses = 0;
  let totalProjectedRevenue = 0;

  for (const category of Object.keys(byCategory)) {
    const categoryMonths = byCategory[category];
    // Last 6 months of data (most recent first for weighted avg)
    const recentValues = allMonths.slice(-6).map(m => categoryMonths[m] ?? 0).reverse();
    const lastSixValues = allMonths.slice(-6).map(m => categoryMonths[m] ?? 0);

    const avg = weightedAvg(recentValues);
    const slope = linearSlope(lastSixValues);
    const sd = stdDev(lastSixValues);

    for (let m = 1; m <= horizonMonths; m++) {
      const futureDate = addMonths(startOfMonth(new Date(`${lastMonth}-01`)), m);
      const month = format(futureDate, 'yyyy-MM');
      const projected = avg + slope * m;
      const clamped = Math.max(0, projected); // expenses can't go negative

      if (m <= horizonMonths) {
        if (category !== 'revenue') totalProjectedExpenses += clamped;
        else totalProjectedRevenue += clamped;
      }

      points.push({
        month,
        category,
        projectedAmount: clamped,
        lowerBound: Math.max(0, clamped - sd),
        upperBound: clamped + sd,
        isActual: false,
      });
    }
  }

  // Calculate runway
  const avgMonthlyExpenses = Object.keys(byCategory)
    .filter(c => c !== 'revenue' && c !== 'internal_transfers')
    .flatMap(c => allMonths.slice(-3).map(m => Math.abs(byCategory[c][m] ?? 0)))
    .reduce((s, v) => s + v, 0) / 3;

  const avgMonthlyRevenue = (byCategory['revenue']
    ? allMonths.slice(-3).map(m => byCategory['revenue'][m] ?? 0).reduce((s, v) => s + v, 0) / 3
    : 0);

  const avgMonthlyNet = avgMonthlyRevenue - avgMonthlyExpenses;
  const runway = avgMonthlyNet < 0 && currentBalance > 0
    ? Math.round(currentBalance / Math.abs(avgMonthlyNet) * 10) / 10
    : null;

  return { points, runway, totalProjectedExpenses, totalProjectedRevenue };
}
