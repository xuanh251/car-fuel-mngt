export interface User {
  id: number;
  email: string;
}

export interface Car {
  id: number;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  licensePlate: string | null;
  fuelType: 'petrol' | 'diesel' | 'lpg' | 'electric' | 'other';
  tankCapacityL: number | null;
  initialOdometerKm: number;
  refuelingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CarInput {
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  licensePlate?: string | null;
  fuelType: 'petrol' | 'diesel' | 'lpg' | 'electric' | 'other';
  tankCapacityL?: number | null;
  initialOdometerKm?: number;
}

export interface Refueling {
  id: number;
  carId: number;
  date: string;
  odometerKm: number;
  liters: number;
  totalCost: number;
  pricePerLiter: number;
  fullTank: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefuelingInput {
  date: string;
  odometerKm: number;
  liters: number;
  totalCost: number;
  fullTank?: boolean;
  notes?: string | null;
}

export interface ReportSummary {
  totalCost: number;
  totalLiters: number;
  refuelingCount: number;
  avgPricePerLiter: number | null;
  distanceKm: number;
  avgConsumptionLPer100Km: number | null;
  costPerKm: number | null;
}

export interface ReportMonthly {
  month: string;
  liters: number;
  cost: number;
  refuelingCount: number;
}

export interface ReportResponse {
  summary: ReportSummary;
  monthly: ReportMonthly[];
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string>;
}
