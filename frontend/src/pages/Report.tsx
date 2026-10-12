import { useEffect, useRef, useState } from 'react';
import type { Dayjs } from 'dayjs';
import { Alert, Card, Col, DatePicker, Empty, Form, Row, Select, Spin, Statistic, Table, Typography, type TableColumnsType } from 'antd';
import { api } from '../api/client';
import type { ReportResponse, ReportMonthly, Car } from '../api/types';
import { applyServerErrors } from '../lib/formErrors';
import { toApiDate } from '../lib/dates';

interface ReportFormValues {
  carId: string;
  from: Dayjs | null;
  to: Dayjs | null;
}

const INITIAL_FILTERS = { carId: 'all', from: '', to: '' };

const toFilters = (values: ReportFormValues) => ({
  carId: values.carId,
  from: toApiDate(values.from),
  to: toApiDate(values.to),
});

const monthlyColumns: TableColumnsType<ReportMonthly> = [
  { title: 'Month', dataIndex: 'month', key: 'month' },
  { title: 'Liters', key: 'liters', render: (_, m) => m.liters.toFixed(2) },
  { title: 'Cost', key: 'cost', render: (_, m) => m.cost.toFixed(2) },
  { title: 'Refuelings', dataIndex: 'refuelingCount', key: 'refuelingCount' },
];

export const Report = () => {
  const [form] = Form.useForm<ReportFormValues>();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const latestRequest = useRef(0);

  const loadCars = async () => {
    try {
      const response = await api.cars.list();
      setCars(response.cars);
    } catch (e: any) {
      console.error('Failed to load cars for report filter', e);
    }
  };

  const loadReport = async (filters: typeof INITIAL_FILTERS) => {
    // Responses can arrive out of order. Only the latest request may update the page.
    const requestId = ++latestRequest.current;
    const isStale = () => requestId !== latestRequest.current;
    setIsLoading(true);
    setError(null);
    form.setFields([{ name: 'from', errors: [] }, { name: 'to', errors: [] }]);
    try {
      const response = await api.report(filters);
      if (isStale()) return;
      setReport(response);
    } catch (e: any) {
      if (isStale()) return;
      // Invalid filters: drop the previous report so its totals are not
      // shown next to the field errors.
      setReport(null);
      if (e.status === 422) {
        setError(applyServerErrors(form, e.fields, e.message));
      } else {
        setError(e.message || 'Failed to load report');
      }
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCars();
    loadReport(INITIAL_FILTERS);
  }, []);

  const handleValuesChange = (_: Partial<ReportFormValues>, values: ReportFormValues) => {
    loadReport(toFilters(values));
  };

  const formatMoney = (val: number | null) => val === null ? '—' : val.toFixed(2);
  const formatLiters = (val: number | null) => val === null ? '—' : val.toFixed(2);
  const formatPricePerL = (val: number | null) => val === null ? '—' : val.toFixed(2);
  const formatKm = (val: number | null) => val === null ? '—' : Math.round(val).toString();
  const formatConsumption = (val: number | null) => val === null ? '—' : val.toFixed(1);
  const formatCostPerKm = (val: number | null) => val === null ? '—' : val.toFixed(3);

  // Values are pre-formatted strings. Statistic would split numeric-looking
  // strings into int/decimal spans, so the formatter passes the value through.
  const tiles = report && [
    { title: 'Total Cost', value: formatMoney(report.summary.totalCost) },
    { title: 'Total Liters', value: formatLiters(report.summary.totalLiters) },
    { title: 'Refuelings', value: String(report.summary.refuelingCount) },
    { title: 'Avg Price/L', value: formatPricePerL(report.summary.avgPricePerLiter) },
    { title: 'Distance', value: `${formatKm(report.summary.distanceKm)} km` },
    { title: 'Consumption', value: `${formatConsumption(report.summary.avgConsumptionLPer100Km)} L/100km` },
    { title: 'Cost/km', value: formatCostPerKm(report.summary.costPerKm) },
  ];

  return (
    <div className="report-page">
      <Typography.Title level={2}>Fuel Consumption Report</Typography.Title>

      <Form
        form={form}
        name="report-filters"
        layout="inline"
        initialValues={{ carId: 'all' }}
        onValuesChange={handleValuesChange}
        style={{ rowGap: 16, marginBottom: 24 }}
      >
        <Form.Item name="carId" label="Car">
          <Select
            style={{ minWidth: 180 }}
            options={[
              { value: 'all', label: 'All cars' },
              ...cars.map((car) => ({ value: String(car.id), label: car.name })),
            ]}
          />
        </Form.Item>
        <Form.Item name="from" label="From">
          <DatePicker format="YYYY-MM-DD" />
        </Form.Item>
        <Form.Item name="to" label="To">
          <DatePicker format="YYYY-MM-DD" />
        </Form.Item>
      </Form>

      <Spin spinning={isLoading}>
        {error ? (
          <Alert type="error" message={error} showIcon />
        ) : report && report.summary.refuelingCount === 0 ? (
          <Empty description="No data available for the selected filters." />
        ) : report && tiles ? (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {tiles.map((tile) => (
                <Col xs={12} md={6} key={tile.title}>
                  <Card size="small" className="summary-tile">
                    <Statistic title={tile.title} value={tile.value} formatter={(value) => value} />
                  </Card>
                </Col>
              ))}
            </Row>

            <Table
              className="monthly-table"
              rowKey="month"
              dataSource={report.monthly}
              columns={monthlyColumns}
              pagination={false}
            />
          </>
        ) : null}
      </Spin>
    </div>
  );
};
