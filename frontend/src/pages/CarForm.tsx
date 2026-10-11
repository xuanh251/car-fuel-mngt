import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { CarInput, ApiError } from '../api/types';

const FUEL_TYPES = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'lpg', label: 'LPG' },
  { value: 'electric', label: 'Electric' },
  { value: 'other', label: 'Other' },
];

export const CarForm = () => {
  const { carId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!carId;

  const [formData, setFormData] = useState<CarInput>({
    name: '',
    make: '',
    model: '',
    year: undefined,
    licensePlate: '',
    fuelType: 'petrol',
    tankCapacityL: undefined,
    initialOdometerKm: 0,
  });

  // Edit pages start in the loading state; the effect clears it once the car is fetched.
  const [isLoadingRecord, setIsLoadingRecord] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (isEdit && carId) {
      api.cars.get(Number(carId))
        .then((car) => {
          setFormData({
            name: car.name,
            make: car.make ?? '',
            model: car.model ?? '',
            year: car.year || undefined,
            licensePlate: car.licensePlate ?? '',
            fuelType: car.fuelType,
            tankCapacityL: car.tankCapacityL || undefined,
            initialOdometerKm: car.initialOdometerKm,
          });
        })
        .catch((e: any) => setError(e.message))
        .finally(() => setIsLoadingRecord(false));
    }
  }, [carId, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    setIsSaving(true);

    try {
      if (isEdit && carId) {
        await api.cars.update(Number(carId), formData);
      } else {
        await api.cars.create(formData);
      }
      navigate('/cars');
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      setFieldErrors(err.fields || null);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingRecord && isEdit) return <div className="loading">Loading...</div>;

  return (
    <div className="form-page">
      <h1>{isEdit ? 'Edit Car' : 'Add Car'}</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            aria-invalid={!!fieldErrors?.name}
            aria-describedby={fieldErrors?.name ? `name-error` : undefined}
          />
          {fieldErrors?.name && <span id="name-error" className="field-error">{fieldErrors.name}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="make">Make</label>
          <input
            id="make"
            type="text"
            value={formData.make ?? ''}
            onChange={(e) => setFormData({ ...formData, make: e.target.value })}
            aria-invalid={!!fieldErrors?.make}
            aria-describedby={fieldErrors?.make ? `make-error` : undefined}
          />
          {fieldErrors?.make && <span id="make-error" className="field-error">{fieldErrors.make}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="model">Model</label>
          <input
            id="model"
            type="text"
            value={formData.model ?? ''}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            aria-invalid={!!fieldErrors?.model}
            aria-describedby={fieldErrors?.model ? `model-error` : undefined}
          />
          {fieldErrors?.model && <span id="model-error" className="field-error">{fieldErrors.model}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="year">Year</label>
          <input
            id="year"
            type="number"
            value={formData.year || ''}
            onChange={(e) => setFormData({ ...formData, year: e.target.value ? Number(e.target.value) : undefined })}
            aria-invalid={!!fieldErrors?.year}
            aria-describedby={fieldErrors?.year ? `year-error` : undefined}
          />
          {fieldErrors?.year && <span id="year-error" className="field-error">{fieldErrors.year}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="licensePlate">License Plate</label>
          <input
            id="licensePlate"
            type="text"
            value={formData.licensePlate ?? ''}
            onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
            aria-invalid={!!fieldErrors?.licensePlate}
            aria-describedby={fieldErrors?.licensePlate ? `licensePlate-error` : undefined}
          />
          {fieldErrors?.licensePlate && <span id="licensePlate-error" className="field-error">{fieldErrors.licensePlate}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="fuelType">Fuel Type *</label>
          <select
            id="fuelType"
            value={formData.fuelType}
            onChange={(e) => setFormData({ ...formData, fuelType: e.target.value as any })}
            required
            aria-invalid={!!fieldErrors?.fuelType}
            aria-describedby={fieldErrors?.fuelType ? `fuelType-error` : undefined}
          >
            {FUEL_TYPES.map(ft => (
              <option key={ft.value} value={ft.value}>{ft.label}</option>
            ))}
          </select>
          {fieldErrors?.fuelType && <span id="fuelType-error" className="field-error">{fieldErrors.fuelType}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="tankCapacityL">Tank Capacity (L)</label>
          <input
            id="tankCapacityL"
            type="number"
            step="0.1"
            value={formData.tankCapacityL || ''}
            onChange={(e) => setFormData({ ...formData, tankCapacityL: e.target.value ? Number(e.target.value) : undefined })}
            aria-invalid={!!fieldErrors?.tankCapacityL}
            aria-describedby={fieldErrors?.tankCapacityL ? `tankCapacityL-error` : undefined}
          />
          {fieldErrors?.tankCapacityL && <span id="tankCapacityL-error" className="field-error">{fieldErrors.tankCapacityL}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="initialOdometerKm">Initial Odometer (km)</label>
          <input
            id="initialOdometerKm"
            type="number"
            value={formData.initialOdometerKm}
            onChange={(e) => setFormData({ ...formData, initialOdometerKm: Number(e.target.value) })}
            required
            aria-invalid={!!fieldErrors?.initialOdometerKm}
            aria-describedby={fieldErrors?.initialOdometerKm ? `initialOdometerKm-error` : undefined}
          />
          {fieldErrors?.initialOdometerKm && <span id="initialOdometerKm-error" className="field-error">{fieldErrors.initialOdometerKm}</span>}
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Car'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/cars')} disabled={isSaving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
