import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Empty, Flex, Space, Spin, Table, Typography, type TableColumnsType } from 'antd';
import { api } from '../api/client';
import type { Refueling } from '../api/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LinkButton } from '../components/LinkButton';
import { SummaryCards } from '../components/SummaryCards';
import { calculateRefuelingStats } from '../lib/refuelingStats';

export const Refuelings = () => {
  const { carId } = useParams();
  const [refuelings, setRefuelings] = useState<Refueling[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingRefueling, setDeletingRefueling] = useState<{id: number, carId: number} | null>(null);
  const stats = useMemo(() => calculateRefuelingStats(refuelings), [refuelings]);

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

  if (!carId) return <Alert type="error" message="No car selected" showIcon />;
  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message={error} showIcon />;

  const columns: TableColumnsType<Refueling> = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Odometer', key: 'odometer', render: (_, r) => `${r.odometerKm} km` },
    { title: 'Liters', key: 'liters', render: (_, r) => `${r.liters.toFixed(2)} L` },
    { title: 'Cost', key: 'cost', render: (_, r) => r.totalCost.toFixed(2) },
    { title: 'Price/L', key: 'pricePerLiter', responsive: ['md'], render: (_, r) => r.pricePerLiter.toFixed(2) },
    { title: 'Full Tank', key: 'fullTank', render: (_, r) => (r.fullTank ? 'Yes' : 'No') },
    { title: 'Notes', key: 'notes', responsive: ['md'], render: (_, r) => r.notes || '—' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space size="middle" wrap>
          <Link to={`/cars/${carId}/refuelings/${r.id}/edit`}>Edit</Link>
          <Button type="link" danger onClick={() => setDeletingRefueling({ id: r.id, carId: Number(carId) })}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="refuelings-page">
      {deleteError && <Alert type="error" message={deleteError} showIcon style={{ marginBottom: 16 }} />}
      <Flex justify="space-between" align="center" wrap gap="middle" style={{ marginBottom: 24 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>Refuelings</Typography.Title>
        <LinkButton to={`/cars/${carId}/refuelings/new`} type="primary">Add Refueling</LinkButton>
      </Flex>

      <SummaryCards stats={stats} />

      {refuelings.length === 0 ? (
        <Empty description="No refuelings found for this car." />
      ) : (
        <Table
          rowKey="id"
          dataSource={refuelings}
          columns={columns}
          pagination={false}
          // On narrow screens the table scrolls inside its own box, not the whole page.
          scroll={{ x: 'max-content' }}
        />
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
