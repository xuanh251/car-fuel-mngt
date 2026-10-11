import { FastifyInstance } from 'fastify';
import { createCarSchema, toCarDto } from './schema.js';
import { ApiError } from '../errors.js';
import { authGuard } from '../auth/guard.js';
import { parseBody } from '../body.js';

export async function carRoutes(fastify: FastifyInstance) {
  const schema = createCarSchema(fastify.now);
  
  // onRequest, not preHandler: the session check must run before body parsing
  fastify.get('/', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const cars = fastify.db.prepare(
      'SELECT *, (SELECT COUNT(*) FROM refuelings WHERE car_id = cars.id) as refuelingCount FROM cars WHERE user_id = ? ORDER BY name COLLATE NOCASE, id'
    ).all(userId) as any[];

    return reply.send({ cars: cars.map(toCarDto) });
  });

  fastify.post('/', { onRequest: [authGuard] }, async (request, reply) => {
    const data = parseBody(schema, request.body);
    const userId = (request as any).userId;
    const now = new Date().toISOString();

    const car = fastify.db.prepare(
      'INSERT INTO cars (user_id, name, make, model, year, license_plate, fuel_type, tank_capacity_l, initial_odometer_km, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      userId,
      data.name,
      data.make || null,
      data.model || null,
      data.year || null,
      data.licensePlate || null,
      data.fuelType,
      data.tankCapacityL || null,
      data.initialOdometerKm,
      now,
      now
    );

    const carId = car.lastInsertRowid;
    const carRow = fastify.db.prepare('SELECT *, (SELECT COUNT(*) FROM refuelings WHERE car_id = cars.id) as refuelingCount FROM cars WHERE id = ?').get(carId) as any;
    
    return reply.status(201).send({
      car: toCarDto(carRow)
    });
  });

  fastify.get('/:carId', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const { carId } = request.params as { carId: string };
    const car = fastify.db.prepare(
      'SELECT *, (SELECT COUNT(*) FROM refuelings WHERE car_id = cars.id) as refuelingCount FROM cars WHERE id = ? AND user_id = ?'
    ).get(carId, userId) as any;

    if (!car) {
      throw new ApiError(404, 'not_found', 'Car not found');
    }

    return reply.send({
      car: toCarDto(car)
    });
  });

  fastify.put('/:carId', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const { carId } = request.params as { carId: string };

    // Fix 7: Ownership check FIRST
    const car = fastify.db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ?').get(carId, userId) as any;
    if (!car) {
      throw new ApiError(404, 'not_found', 'Car not found');
    }

    const data = parseBody(schema, request.body);

    // Odometer guard: must be <= lowest refueling odometer
    const minRefuelingOdo = fastify.db.prepare('SELECT MIN(odometer_km) as minOdo FROM refuelings WHERE car_id = ?').get(carId) as any;
    if (minRefuelingOdo?.minOdo !== null && data.initialOdometerKm > minRefuelingOdo.minOdo) {
      throw new ApiError(422, 'validation_failed', 'Initial odometer cannot be greater than existing refuelings', {
        initialOdometerKm: 'Initial odometer must be <= lowest refueling odometer',
      });
    }

    const now = new Date().toISOString();
    fastify.db.prepare(
      'UPDATE cars SET name = ?, make = ?, model = ?, year = ?, license_plate = ?, fuel_type = ?, tank_capacity_l = ?, initial_odometer_km = ?, updated_at = ? WHERE id = ?'
    ).run(
      data.name,
      data.make || null,
      data.model || null,
      data.year || null,
      data.licensePlate || null,
      data.fuelType,
      data.tankCapacityL || null,
      data.initialOdometerKm,
      now,
      carId
    );

    const updatedCar = fastify.db.prepare('SELECT *, (SELECT COUNT(*) FROM refuelings WHERE car_id = cars.id) as refuelingCount FROM cars WHERE id = ?').get(carId) as any;
    
    return reply.send({
      car: toCarDto(updatedCar)
    });
  });

  fastify.delete('/:carId', { onRequest: [authGuard] }, async (request, reply) => {
    const userId = (request as any).userId;
    const { carId } = request.params as { carId: string };

    const car = fastify.db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ?').get(carId, userId) as any;
    if (!car) {
      throw new ApiError(404, 'not_found', 'Car not found');
    }

    fastify.db.prepare('DELETE FROM cars WHERE id = ?').run(carId);
    return reply.status(204).send();
  });
}
