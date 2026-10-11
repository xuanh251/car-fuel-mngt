import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import { authGuard } from '../auth/guard.js';
import { calculateReport } from './calc.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => {
  const [y, m, d] = val.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}, { message: 'Invalid date format. Expected YYYY-MM-DD' });

// A repeated carId arrives as an array; zod rejects it here instead of at SQLite bind time.
const querySchema = z.object({
  carId: z.string().regex(/^(all|[1-9]\d*)$/, { message: 'Must be "all" or a positive integer' }).optional(),
});

export async function reportRoutes(fastify: FastifyInstance) {
  
  fastify.get('/report', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const { carId } = querySchema.parse(request.query);
    const { from, to } = request.query as any;

    if (from) {
      const res = dateSchema.safeParse(from);
      if (!res.success) {
        throw new ApiError(422, 'validation_failed', 'Invalid from date', { from: 'Invalid date format' });
      }
    }

    if (to) {
      const res = dateSchema.safeParse(to);
      if (!res.success) {
        throw new ApiError(422, 'validation_failed', 'Invalid to date', { to: 'Invalid date format' });
      }
    }

    if (from && to && from > to) {
      throw new ApiError(422, 'validation_failed', 'From date cannot be after to date', {
        to: 'From date cannot be after to date',
      });
    }

    // Filter cars
    let targetCars: number[] = [];
    if (!carId || carId === 'all') {
      const cars = fastify.db.prepare('SELECT id FROM cars WHERE user_id = ?').all(userId) as any[];
      targetCars = cars.map(c => c.id);
    } else {
      const car = fastify.db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ?').get(carId, userId) as any;
      if (!car) {
        throw new ApiError(404, 'not_found', 'Car not found');
      }
      targetCars = [car.id];
    }

    // Fetch refuelings
    const refuelings = fastify.db.prepare(
      'SELECT r.* FROM refuelings r JOIN cars c ON r.car_id = c.id WHERE c.user_id = ? AND r.car_id IN (' + 
      targetCars.map(() => '?').join(',') + 
      ')'
    ).all(userId, ...targetCars) as any[];

    // Filter by date range in JS for simplicity or SQL
    const filteredRefuelings = refuelings.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });

    // Group by car for calculateReport
    const refuelingsByCar = new Map<number, any[]>();
    for (const r of filteredRefuelings) {
      if (!refuelingsByCar.has(r.car_id)) {
        refuelingsByCar.set(r.car_id, []);
      }
      refuelingsByCar.get(r.car_id)!.push({
        id: r.id,
        carId: r.car_id,
        date: r.date,
        odometerKm: r.odometer_km,
        liters: r.liters,
        totalCost: r.total_cost_cents / 100,
        fullTank: !!r.full_tank,
      });
    }

    return reply.send(calculateReport(refuelingsByCar));
  });
}
