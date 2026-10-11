import { z } from 'zod';

// Exact: rounding to `places` and parsing back must give the same number.
// Number.toString() would miss exponent forms such as 1e-7.
function atMostDecimals(places: number) {
  return (val: number) => Number(val.toFixed(places)) === val;
}

export function createRefuelingSchema(now: () => Date) {
  return z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => {
      const [y, m, d] = val.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        return false;
      }
      
      // Local date of now()
      const today = now();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      return val <= todayStr;
    }, { message: 'Date must be a valid calendar date and not in the future' }),
    odometerKm: z.number().int().min(0).max(9999999),
    liters: z.number().gt(0).lte(1000).refine(atMostDecimals(3), { message: 'Liters can have at most 3 decimals' }),
    totalCost: z.number().min(0).max(1000000).refine(atMostDecimals(2), { message: 'Total cost can have at most 2 decimals' }),
    fullTank: z.boolean().optional().default(true),
    notes: z.string().max(500).optional().or(z.literal('')),
  });
}

export type RefuelingInput = z.infer<ReturnType<typeof createRefuelingSchema>>;
