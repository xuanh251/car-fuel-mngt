import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Refueling } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const Refuelings = () => {
  const { carId } = useParams();
  const [refuelings, setRefuelings] = useState<Refueling[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingRefueling, setDeletingRefueling] = useState<{id: number, carId: number} | null>(null);

  const loadRefuelings = async () => {
    if (!carId) return;
    setIsLoading(true);
    setError(null);
    setDeleteError(null);
    try {
      const response = await api.refuelings.list(Number(carId));
      setRefuelings(response.refuelings);
    } catch (e: any) {
      setError(e.message || 'Failed to load refuelings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRefuelings();
  }, [carId]);

  const handleDelete = async () => {
    if (!deletingRefueling) return;
    setDeleteError(null);
    try {
      await api.refuelings.delete(deletingRefueling.carId, deletingRefueling.id);
      setRefuelings(refuelings.filter((r) => r.id !== deletingRefueling.id));
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete refueling');
    } finally {
      setDeletingRefueling(null);
    }
  };

  if (!carId) return <div className="error">No car selected</div>;
  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="refuelings-page">
      {deleteError && <div className="error-message">{deleteError}</div>}
      <div className="page-header">
        <h1>Refuelings</h1>
        <Link to={`/cars/${carId}/refuelings/new`} className="btn-primary">Add Refueling</Link>
      </div>

      {refuelings.length === 0 ? (
        <div className="empty-state">No refuelings found for this car.</div>
      ) : (
        <div className="table-container">
          <table className="refuelings-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Odometer</th>
                <th>Liters</th>
                <th>Cost</th>
                <th>Price/L</th>
                <th>Full Tank</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {refuelings.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date">{r.date}</td>
                  <td data-label="Odometer">{r.odometerKm} km</td>
                  <td data-label="Liters">{r.liters.toFixed(2)} L</td>
                  <td data-label="Cost">{r.totalCost.toFixed(2)}</td>
                  <td data-label="Price/L">{r.pricePerLiter.toFixed(2)}</td>
                  <td data-label="Full Tank">{r.fullTank ? 'Yes' : 'No'}</td>
                  <td data-label="Notes">{r.notes || '—'}</td>
                  <td data-label="Actions" className="actions">
                    <Link to={`/cars/${carId}/refuelings/${r.id}/edit`}>Edit</Link>
                    <button onClick={() => setDeletingRefueling({ id: r.id, carId: Number(carId) })}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deletingRefueling && (
        <ConfirmDialog
          isOpen={!!deletingRefueling}
          onClose={() => setDeletingRefueling(null)}
          onConfirm={handleDelete}
          title="Delete Refueling"
          message="Are you sure you want to delete this refueling? This cannot be undone."
        />
      )}
    </div>
  );
};
