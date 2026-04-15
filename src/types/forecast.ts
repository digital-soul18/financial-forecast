export interface ForecastPoint {
  month: string; // "2026-05"
  category: string;
  projectedAmount: number;
  lowerBound: number;
  upperBound: number;
  isActual: boolean;
}

export interface ForecastResult {
  points: ForecastPoint[];
  runway: number | null;
  totalProjectedExpenses: number;
  totalProjectedRevenue: number;
}

export interface MonthlyTotal {
  month: string;
  category: string;
  total: number;
}
