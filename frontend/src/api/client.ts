import type { ApiError, Car, CarInput, Refueling, RefuelingInput, ReportResponse, User } from './types';

let onError: ((error: ApiError) => void) | null = null;

export const setApiErrorHandler = (handler: (error: ApiError) => void) => {
  onError = handler;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Content-Type only with a body: an empty JSON body fails on DELETE and logout.
  const headers = options.body === undefined
    ? options.headers
    : { 'Content-Type': 'application/json', ...options.headers };
  const response = await fetch(path, { ...options, headers });

  if (response.ok) {
    if (response.status === 204) {
      return {} as T;
    }
    const body = await response.json();
    return body as T;
  }

  let errorBody: any;
  try {
    errorBody = await response.json();
  } catch {
    errorBody = { message: 'Unknown error occurred' };
  }

  const error: ApiError = {
    status: response.status,
    code: errorBody.error || 'unknown_error',
    message: errorBody.message || 'An unexpected error occurred',
    fields: errorBody.fields,
  };

  if (error.status === 401 && onError && !path.startsWith('/api/auth')) {
    onError(error);
  }

  throw error;
}

export const api = {
  auth: {
    register: (body: { email: string; password: string }) =>
      request<{ user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    login: (body: { email: string; password: string }) =>
      request<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
    me: () => request<{ user: User }>('/api/auth/me'),
  },
  cars: {
    list: () => request<{ cars: Car[] }>('/api/cars'),
    create: (body: CarInput) =>
      request<{ car: Car }>('/api/cars', { method: 'POST', body: JSON.stringify(body) })
        .then((r) => r.car),
    get: (carId: number) =>
      request<{ car: Car }>(`/api/cars/${carId}`).then((r) => r.car),
    update: (carId: number, body: CarInput) =>
      request<{ car: Car }>(`/api/cars/${carId}`, { method: 'PUT', body: JSON.stringify(body) })
        .then((r) => r.car),
    delete: (carId: number) => request<void>(`/api/cars/${carId}`, { method: 'DELETE' }),
  },
  refuelings: {
    list: (carId: number) =>
      request<{ refuelings: Refueling[] }>(`/api/cars/${carId}/refuelings`),
    create: (carId: number, body: RefuelingInput) =>
      request<{ refueling: Refueling }>(`/api/cars/${carId}/refuelings`, {
        method: 'POST',
        body: JSON.stringify(body),
      }).then((r) => r.refueling),
    get: (carId: number, id: number) =>
      request<{ refueling: Refueling }>(`/api/cars/${carId}/refuelings/${id}`)
        .then((r) => r.refueling),
    update: (carId: number, id: number, body: RefuelingInput) =>
      request<{ refueling: Refueling }>(`/api/cars/${carId}/refuelings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }).then((r) => r.refueling),
    delete: (carId: number, id: number) =>
      request<void>(`/api/cars/${carId}/refuelings/${id}`, { method: 'DELETE' }),
  },
  report: (params: { carId?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params.carId) query.append('carId', params.carId);
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to);
    return request<ReportResponse>(`/api/report?${query.toString()}`);
  },
};
