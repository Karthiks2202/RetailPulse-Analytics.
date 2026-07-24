/**
 * Shared currency formatter for the RetailPulse platform.
 * Uses Indian Rupee (INR, ₹) with en-IN locale for proper
 * lakh/crore grouping (e.g. ₹1,00,000).
 */
const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number): string => formatter.format(value);
