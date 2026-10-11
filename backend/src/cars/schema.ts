import { z } from 'zod';

export function createCarSchema(now: () => Date) {
  return z.object({
    name: z.string().trim().min(1).max(100),
    make: z.string().trim().max(100).optional().or(z.literal('')),
    model: z.string().trim().max(100).optional().or(z.literal('')),
    year: z.number().int().min(1900).optional().refine(val => val === undefined || val <= now().getFullYear() + 1, {
      message: 'Year must be at most next year',
    }),
    licensePlate: z.string().trim().max(20).optional().or(z.literal('')),
    fuelType: z.enum(['petrol', 'diesel', 'lpg', 'electric', 'other']),
    tankCapacityL: z.number().gt(0).lte(1000).optional(),
    initialOdometerKm: z.number().int().min(0).max(9999999).optional().default(0),
  });
}

export type CarInput = z.infer<ReturnType<typeof createCarSchema>>;

export interface CarDto {
  id: number;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  licensePlate: string | null;
  fuelType: string;
  tankCapacityL: number | null;
  initialOdometerKm: number;
  refuelingCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toCarDto(row: any): CarDto {
  return {
    id: row.id,
    name: row.name,
    make: row.make,
    model: row.model,
    year: row.year,
    licensePlate: row.license_plate,
    fuelType: row.fuel_type,
    tankCapacityL: row.tank_capacity_l,
    initialOdometerKm: row.initial_odometer_km,
    refuelingCount: row.refuelingCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
