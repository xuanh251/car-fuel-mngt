import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Car } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const Cars = () => {
  const [cars, setCars] = useState<Car[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingCar, setDeletingCar] = useState<Car | null>(null);

  const loadCars = async () => {
    setIsLoading(true);
    setError(null);
    setDeleteError(null);
    try {
      const response = await api.cars.list();
      setCars(response.cars);
    } catch (e: any) {
      setError(e.message || 'Failed to load cars');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCars();
  }, []);

  const handleDelete = async () => {
    if (!deletingCar) return;
    setDeleteError(null);
    try {
      await api.cars.delete(deletingCar.id);
      setCars(cars.filter((c) => c.id !== deletingCar.id));
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete car');
    } finally {
      setDeletingCar(null);
    }
  };

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="cars-page">
      {deleteError && <div className="error-message">{deleteError}</div>}
      <div className="page-header">
        <h1>My Cars</h1>
        <Link to="/cars/new" className="btn-primary">Add Car</Link>
      </div>

      {cars.length === 0 ? (
        <div className="empty-state">You have no cars. Add one to get started!</div>
      ) : (
        <ul className="cars-list">
          {cars.map((car) => {
            const details = [car.make, car.model, car.year ? `${car.year}` : null].filter(Boolean).join(' ');
            return (
              <li key={car.id} className="car-item">
                <div className="car-info">
                  <strong>{car.name}</strong>
                  {details && <span>{details}</span>}
                </div>
                <div className="car-actions">
                  <Link to={`/cars/${car.id}/refuelings`}>Refuelings</Link>
                  <Link to={`/cars/${car.id}/edit`}>Edit</Link>
                  <button onClick={() => setDeletingCar(car)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deletingCar && (
        <ConfirmDialog
          isOpen={!!deletingCar}
          onClose={() => setDeletingCar(null)}
          onConfirm={handleDelete}
          title="Delete Car"
          message={`Delete "${deletingCar.name}"? Deleting this car also deletes its ${deletingCar.refuelingCount === 1 ? '1 refueling' : `${deletingCar.refuelingCount} refuelings`}. This cannot be undone.`}
        />
      )}
    </div>
  );
};
