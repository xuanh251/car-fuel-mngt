import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { ReportResponse, Car } from '../api/types';

export const Report = () => {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [filters, setFilters] = useState({
    carId: 'all',
    from: '',
    to: '',
  });
  const latestRequest = useRef(0);

  const loadCars = async () => {
    try {
      const response = await api.cars.list();
      setCars(response.cars);
    } catch (e: any) {
      console.error('Failed to load cars for report filter', e);
    }
  };

  const loadReport = async () => {
    // Responses can arrive out of order. Only the latest request may update the page.
    const requestId = ++latestRequest.current;
    const isStale = () => requestId !== latestRequest.current;
    setIsLoading(true);
    setError(null);
    setFieldErrors(null);
    try {
      const response = await api.report(filters);
      if (isStale()) return;
      setReport(response);
    } catch (e: any) {
      if (isStale()) return;
      if (e.status === 422) {
        // Invalid filters: drop the previous report so its totals are not
        // shown next to the field errors.
        setReport(null);
        setFieldErrors(e.fields || null);
      } else {
        setError(e.message || 'Failed to load report');
      }
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCars();
  }, []);

  useEffect(() => {
    loadReport();
  }, [filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { id, value } = e.target;
    setFilters((prev) => ({ ...prev, [id]: value }));
  };

  const formatMoney = (val: number | null) => val === null ? '—' : val.toFixed(2);
  const formatLiters = (val: number | null) => val === null ? '—' : val.toFixed(2);
  const formatPricePerL = (val: number | null) => val === null ? '—' : val.toFixed(2);
  const formatKm = (val: number | null) => val === null ? '—' : Math.round(val).toString();
  const formatConsumption = (val: number | null) => val === null ? '—' : val.toFixed(1);
  const formatCostPerKm = (val: number | null) => val === null ? '—' : val.toFixed(3);

  return (
    <div className="report-page">
      <div className="page-header">
        <h1>Fuel Consumption Report</h1>
      </div>

      <div className="report-filters">
        <div className="filter-field">
          <label htmlFor="carId">Car</label>
          <select id="carId" value={filters.carId} onChange={handleFilterChange}>
            <option value="all">All cars</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>{car.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="from">From</label>
          <input
            id="from"
            type="date"
            value={filters.from}
            onChange={handleFilterChange}
            aria-invalid={!!fieldErrors?.from}
            aria-describedby={fieldErrors?.from ? `from-error` : undefined}
          />
          {fieldErrors?.from && <span id="from-error" className="field-error">{fieldErrors.from}</span>}
        </div>
        <div className="filter-field">
          <label htmlFor="to">To</label>
          <input
            id="to"
            type="date"
            value={filters.to}
            onChange={handleFilterChange}
            aria-invalid={!!fieldErrors?.to}
            aria-describedby={fieldErrors?.to ? `to-error` : undefined}
          />
          {fieldErrors?.to && <span id="to-error" className="field-error">{fieldErrors.to}</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : report ? (
        <>
          {report.summary.refuelingCount === 0 ? (
            <div className="empty-state">No data available for the selected filters.</div>
          ) : (
            <>
              <div className="summary-grid">
                <div className="summary-tile">
                  <div className="tile-label">Total Cost</div>
                  <div className="tile-value">{formatMoney(report.summary.totalCost)}</div>
                </div>
                <div className="summary-tile">
                  <div className="tile-label">Total Liters</div>
                  <div className="tile-value">{formatLiters(report.summary.totalLiters)}</div>
                </div>
                <div className="summary-tile">
                  <div className="tile-label">Refuelings</div>
                  <div className="tile-value">{report.summary.refuelingCount}</div>
                </div>
                <div className="summary-tile">
                  <div className="tile-label">Avg Price/L</div>
                  <div className="tile-value">{formatPricePerL(report.summary.avgPricePerLiter)}</div>
                </div>
                <div className="summary-tile">
                  <div className="tile-label">Distance</div>
                  <div className="tile-value">{formatKm(report.summary.distanceKm)} km</div>
                </div>
                <div className="summary-tile">
                  <div className="tile-label">Consumption</div>
                  <div className="tile-value">{formatConsumption(report.summary.avgConsumptionLPer100Km)} L/100km</div>
                </div>
                <div className="summary-tile">
                  <div className="tile-label">Cost/km</div>
                  <div className="tile-value">{formatCostPerKm(report.summary.costPerKm)}</div>
                </div>
              </div>

              <div className="table-container">
                <table className="monthly-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Liters</th>
                      <th>Cost</th>
                      <th>Refuelings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthly.map((m) => (
                      <tr key={m.month}>
                        <td data-label="Month">{m.month}</td>
                        <td data-label="Liters">{m.liters.toFixed(2)}</td>
                        <td data-label="Cost">{m.cost.toFixed(2)}</td>
                        <td data-label="Refuelings">{m.refuelingCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
};
