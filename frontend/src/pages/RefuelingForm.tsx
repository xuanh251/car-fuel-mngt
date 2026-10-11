import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { RefuelingInput, ApiError } from '../api/types';

const getLocalDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const RefuelingForm = () => {
  const { carId, refuelingId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!refuelingId;
  const [today] = useState(getLocalDate);

  const [formData, setFormData] = useState<RefuelingInput>({
    date: today,
    odometerKm: 0,
    liters: 0,
    totalCost: 0,
    fullTank: true,
    notes: '',
  });

  // Edit pages start in the loading state; the effect clears it once the refueling is fetched.
  const [isLoadingRecord, setIsLoadingRecord] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (isEdit && carId && refuelingId) {
      api.refuelings.get(Number(carId), Number(refuelingId))
        .then((r) => {
          setFormData({
            date: r.date,
            odometerKm: r.odometerKm,
            liters: r.liters,
            totalCost: r.totalCost,
            fullTank: r.fullTank,
            notes: r.notes || '',
          });
        })
        .catch((e: any) => setError(e.message))
        .finally(() => setIsLoadingRecord(false));
    }
  }, [carId, refuelingId, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    setIsSaving(true);

    try {
      if (isEdit && carId && refuelingId) {
        await api.refuelings.update(Number(carId), Number(refuelingId), formData);
      } else if (carId) {
        await api.refuelings.create(Number(carId), formData);
      }
      navigate(`/cars/${carId}/refuelings`);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      setFieldErrors(err.fields || null);
    } finally {
      setIsSaving(false);
    }
  };

  const pricePerLiter = formData.liters > 0 ? formData.totalCost / formData.liters : 0;

  if (isLoadingRecord && isEdit) return <div className="loading">Loading...</div>;

  return (
    <div className="form-page">
      <h1>{isEdit ? 'Edit Refueling' : 'Add Refueling'}</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="date">Date *</label>
          <input
            id="date"
            type="date"
            max={today}
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            aria-invalid={!!fieldErrors?.date}
            aria-describedby={fieldErrors?.date ? `date-error` : undefined}
          />
          {fieldErrors?.date && <span id="date-error" className="field-error">{fieldErrors.date}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="odometerKm">Odometer (km) *</label>
          <input
            id="odometerKm"
            type="number"
            value={formData.odometerKm}
            onChange={(e) => setFormData({ ...formData, odometerKm: Number(e.target.value) })}
            required
            aria-invalid={!!fieldErrors?.odometerKm}
            aria-describedby={fieldErrors?.odometerKm ? `odometerKm-error` : undefined}
          />
          {fieldErrors?.odometerKm && <span id="odometerKm-error" className="field-error">{fieldErrors.odometerKm}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="liters">Liters *</label>
          <input
            id="liters"
            type="number"
            step="0.001"
            value={formData.liters || ''}
            onChange={(e) => setFormData({ ...formData, liters: e.target.value ? Number(e.target.value) : 0 })}
            required
            aria-invalid={!!fieldErrors?.liters}
            aria-describedby={fieldErrors?.liters ? `liters-error` : undefined}
          />
          {fieldErrors?.liters && <span id="liters-error" className="field-error">{fieldErrors.liters}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="totalCost">Total Cost *</label>
          <input
            id="totalCost"
            type="number"
            step="0.01"
            value={formData.totalCost || ''}
            onChange={(e) => setFormData({ ...formData, totalCost: e.target.value ? Number(e.target.value) : 0 })}
            required
            aria-invalid={!!fieldErrors?.totalCost}
            aria-describedby={fieldErrors?.totalCost ? `totalCost-error` : undefined}
          />
          {fieldErrors?.totalCost && <span id="totalCost-error" className="field-error">{fieldErrors.totalCost}</span>}
        </div>
        <div className="price-preview">
          Price per Liter: <strong>{pricePerLiter.toFixed(2)}</strong>
        </div>
        <div className="form-field checkbox">
          <label>
            <input
              type="checkbox"
              checked={formData.fullTank}
              onChange={(e) => setFormData({ ...formData, fullTank: e.target.checked })}
            />
            Full Tank
          </label>
        </div>
        <div className="form-field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            maxLength={500}
            aria-invalid={!!fieldErrors?.notes}
            aria-describedby={fieldErrors?.notes ? `notes-error` : undefined}
          />
          <div className="char-counter">{ (formData.notes || '').length } / 500</div>
          {fieldErrors?.notes && <span id="notes-error" className="field-error">{fieldErrors.notes}</span>}
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Refueling'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(`/cars/${carId}/refuelings`)} disabled={isSaving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
