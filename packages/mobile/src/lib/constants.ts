import Constants from 'expo-constants';

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3000';

// Fallback tax rate (decimal fraction) used until server settings load or if unavailable.
export const DEFAULT_TAX_RATE = 0.08;
export const DEFAULT_DELIVERY_FEE = 4.99;
export const LOYALTY_POINTS_PER_DOLLAR = 100; // 100 points = $1.00
