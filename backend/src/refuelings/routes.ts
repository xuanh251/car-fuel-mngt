import { FastifyInstance } from 'fastify';
import { createRefuelingSchema } from './schema.js';
import { ApiError } from '../errors.js';
import { authGuard } from '../auth/guard.js';
import { parseBody } from '../body.js';

export async function refuelingRoutes(fastify: FastifyInstance) {
  const schema = createRefuelingSchema(fastify.now);
  
  fastify.get('/:carId/refuelings', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const { carId } = request.params as { carId: string };

    const car = fastify.db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ?').get(carId, userId) as any;
    if (!car) {
      throw new ApiError(404, 'not_found', 'Car not found');
    }

    const refuelings = fastify.db.prepare(
      'SELECT * FROM refuelings WHERE car_id = ? ORDER BY date DESC, odometer_km DESC, id DESC'
    ).all(carId) as any[];

    return reply.send({
      refuelings: refuelings.map(r => ({
        id: r.id,
        carId: r.car_id,
        date: r.date,
        odometerKm: r.odometer_km,
        liters: r.liters,
        totalCost: r.total_cost_cents / 100,
        pricePerLiter: r.total_cost_cents / (r.liters * 100),
        fullTank: !!r.full_tank,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }))
    });
  });

  fastify.post('/:carId/refuelings', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const { carId } = request.params as { carId: string };

    const car = fastify.db.prepare('SELECT id, initial_odometer_km FROM cars WHERE id = ? AND user_id = ?').get(carId, userId) as any;
    if (!car) {
      throw new ApiError(404, 'not_found', 'Car not found');
    }

    const data = parseBody(schema, request.body);

    if (data.odometerKm < car.initial_odometer_km) {
      throw new ApiError(422, 'validation_failed', 'Odometer cannot be less than car initial odometer', {
        odometerKm: `Odometer must be >= ${car.initial_odometer_km}`,
      });
    }

    const now = new Date().toISOString();
    const totalCostCents = Math.round(data.totalCost * 100);

    const refueling = fastify.db.prepare(
      'INSERT INTO refuelings (car_id, date, odometer_km, liters, total_cost_cents, full_tank, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      carId,
      data.date,
      data.odometerKm,
      data.liters,
      totalCostCents,
      data.fullTank ? 1 : 0,
      data.notes || null,
      now,
      now
    );

    const refuelingId = refueling.lastInsertRowid;
    const row = fastify.db.prepare('SELECT * FROM refuelings WHERE id = ?').get(refuelingId) as any;

    return reply.status(201).send({
      refueling: {
        id: row.id,
        carId: row.car_id,
        date: row.date,
        odometerKm: row.odometer_km,
        liters: row.liters,
        totalCost: row.total_cost_cents / 100,
        pricePerLiter: row.total_cost_cents / (row.liters * 100),
        fullTank: !!row.full_tank,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    });
  });

  fastify.get('/:carId/refuelings/:id', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const { carId, id } = request.params as { carId: string; id: string };

    const refueling = fastify.db.prepare(
      'SELECT r.* FROM refuelings r JOIN cars c ON r.car_id = c.id WHERE r.id = ? AND c.id = ? AND c.user_id = ?'
    ).get(id, carId, userId) as any;

    if (!refueling) {
      throw new ApiError(404, 'not_found', 'Refueling not found');
    }

    return reply.send({
      refueling: {
        id: refueling.id,
        carId: refueling.car_id,
        date: refueling.date,
        odometerKm: refueling.odometer_km,
        liters: refueling.liters,
        totalCost: refueling.total_cost_cents / 100,
        pricePerLiter: refueling.total_cost_cents / (refueling.liters * 100),
        fullTank: !!refueling.full_tank,
        notes: refueling.notes,
        createdAt: refueling.created_at,
        updatedAt: refueling.updated_at,
      }
    });
  });

  fastify.put('/:carId/refuelings/:id', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const { carId, id } = request.params as { carId: string; id: string };

    const refueling = fastify.db.prepare(
      'SELECT r.id FROM refuelings r JOIN cars c ON r.car_id = c.id WHERE r.id = ? AND c.id = ? AND c.user_id = ?'
    ).get(id, carId, userId) as any;

    if (!refueling) {
      throw new ApiError(404, 'not_found', 'Refueling not found');
    }

    const car = fastify.db.prepare('SELECT id, initial_odometer_km FROM cars WHERE id = ? AND user_id = ?').get(carId, userId) as any;
    if (!car) {
      throw new ApiError(404, 'not_found', 'Car not found');
    }

    const data = parseBody(schema, request.body);

    if (data.odometerKm < car.initial_odometer_km) {
      throw new ApiError(422, 'validation_failed', 'Odometer cannot be less than car initial odometer', {
        odometerKm: `Odometer must be >= ${car.initial_odometer_km}`,
      });
    }

    const now = new Date().toISOString();
    const totalCostCents = Math.round(data.totalCost * 100);

    fastify.db.prepare(
      'UPDATE refuelings SET date = ?, odometer_km = ?, liters = ?, total_cost_cents = ?, full_tank = ?, notes = ?, updated_at = ? WHERE id = ?'
    ).run(
      data.date,
      data.odometerKm,
      data.liters,
      totalCostCents,
      data.fullTank ? 1 : 0,
      data.notes || null,
      now,
      id
    );

    const row = fastify.db.prepare('SELECT * FROM refuelings WHERE id = ?').get(id) as any;

    return reply.send({
      refueling: {
        id: row.id,
        carId: row.car_id,
        date: row.date,
        odometerKm: row.odometer_km,
        liters: row.liters,
        totalCost: row.total_cost_cents / 100,
        pricePerLiter: row.total_cost_cents / (row.liters * 100),
        fullTank: !!row.full_tank,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    });
  });

  fastify.delete('/:carId/refuelings/:id', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const { carId, id } = request.params as { carId: string; id: string };

    const refueling = fastify.db.prepare(
      'SELECT r.id FROM refuelings r JOIN cars c ON r.car_id = c.id WHERE r.id = ? AND c.id = ? AND c.user_id = ?'
    ).get(id, carId, userId) as any;

    if (!refueling) {
      throw new ApiError(404, 'not_found', 'Refueling not found');
    }

    fastify.db.prepare('DELETE FROM refuelings WHERE id = ?').run(id);
    return reply.status(204).send();
  });
}
