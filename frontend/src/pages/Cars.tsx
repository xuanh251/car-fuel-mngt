import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Empty, Flex, Space, Spin, Table, Typography, type TableColumnsType } from 'antd';
import { api } from '../api/client';
import type { Car } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LinkButton } from '../components/LinkButton';

const formatDetails = (car: Car) =>
  [car.make, car.model, car.year ? `${car.year}` : null].filter(Boolean).join(' ');

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

  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message={error} showIcon />;

  const columns: TableColumnsType<Car> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Details', key: 'details', responsive: ['sm'], render: (_, car) => formatDetails(car) },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, car) => (
        <Space size="middle" wrap>
          <Link to={`/cars/${car.id}/refuelings`}>Refuelings</Link>
          <Link to={`/cars/${car.id}/edit`}>Edit</Link>
          <Button type="link" danger onClick={() => setDeletingCar(car)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="cars-page">
      {deleteError && <Alert type="error" message={deleteError} showIcon style={{ marginBottom: 16 }} />}
      <Flex justify="space-between" align="center" wrap gap="middle" style={{ marginBottom: 24 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>My Cars</Typography.Title>
        <LinkButton to="/cars/new" type="primary">Add Car</LinkButton>
      </Flex>

      {cars.length === 0 ? (
        <Empty description="You have no cars. Add one to get started!" />
      ) : (
        <Table
          rowKey="id"
          rowClassName="car-item"
          dataSource={cars}
          columns={columns}
          pagination={false}
        />
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
