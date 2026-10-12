import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import { Alert, Button, Card, Checkbox, Col, DatePicker, Flex, Form, Input, InputNumber, Row, Spin, Typography } from 'antd';
import { api } from '../api/client';
import type { RefuelingInput, ApiError } from '../api/types';
import { applyServerErrors } from '../lib/formErrors';
import { fromApiDate, toApiDate } from '../lib/dates';

interface RefuelingFormValues {
  date: Dayjs | null;
  odometerKm: number | null;
  liters: number | null;
  totalCost: number | null;
  fullTank: boolean;
  notes: string;
}

export const RefuelingForm = () => {
  const { carId, refuelingId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!refuelingId;
  const [form] = Form.useForm<RefuelingFormValues>();
  const liters = Form.useWatch('liters', form);
  const totalCost = Form.useWatch('totalCost', form);

  // Edit pages start in the loading state; the effect clears it once the refueling is fetched.
  const [isLoadingRecord, setIsLoadingRecord] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && carId && refuelingId) {
      api.refuelings.get(Number(carId), Number(refuelingId))
        .then((r) => {
          form.setFieldsValue({
            date: fromApiDate(r.date),
            odometerKm: r.odometerKm,
            liters: r.liters,
            totalCost: r.totalCost,
            fullTank: r.fullTank,
            notes: r.notes || '',
          });
        })
        .catch((e: any) => setFormError(e.message))
        .finally(() => setIsLoadingRecord(false));
    }
  }, [carId, refuelingId, isEdit, form]);

  const handleFinish = async (values: RefuelingFormValues) => {
    setFormError(null);
    setIsSaving(true);

    const body: RefuelingInput = {
      date: toApiDate(values.date),
      odometerKm: values.odometerKm ?? 0,
      liters: values.liters ?? 0,
      totalCost: values.totalCost ?? 0,
      fullTank: values.fullTank,
      notes: values.notes ?? '',
    };

    try {
      if (isEdit && carId && refuelingId) {
        await api.refuelings.update(Number(carId), Number(refuelingId), body);
      } else if (carId) {
        await api.refuelings.create(Number(carId), body);
      }
      navigate(`/cars/${carId}/refuelings`);
    } catch (e) {
      const err = e as ApiError;
      setFormError(applyServerErrors(form, err.fields, err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const litersValue = liters ?? 0;
  const pricePerLiter = litersValue > 0 ? (totalCost ?? 0) / litersValue : 0;

  return (
    <Card style={{ maxWidth: 720, margin: '0 auto' }}>
      <Typography.Title level={2}>{isEdit ? 'Edit Refueling' : 'Add Refueling'}</Typography.Title>
      {formError && <Alert type="error" message={formError} showIcon style={{ marginBottom: 16 }} />}
      <Spin spinning={isLoadingRecord}>
        <Form
          form={form}
          name="refueling"
          layout="vertical"
          initialValues={{ date: dayjs().startOf('day'), fullTank: true, notes: '' }}
          onFinish={handleFinish}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select a date' }]}>
                <DatePicker
                  format="YYYY-MM-DD"
                  allowClear={false}
                  disabledDate={(current) => current.isAfter(dayjs(), 'day')}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="odometerKm" label="Odometer (km)" rules={[{ required: true, message: 'Please enter the odometer' }]}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="liters" label="Liters" rules={[{ required: true, message: 'Please enter the liters' }]}>
                <InputNumber step={0.001} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="totalCost" label="Total Cost" rules={[{ required: true, message: 'Please enter the total cost' }]}>
                <InputNumber step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Paragraph type="secondary" style={{ textAlign: 'right' }}>
            Price per Liter: <strong>{pricePerLiter.toFixed(2)}</strong>
          </Typography.Paragraph>
          <Form.Item name="fullTank" valuePropName="checked">
            <Checkbox>Full Tank</Checkbox>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea maxLength={500} showCount rows={3} />
          </Form.Item>
          <Flex gap="small" justify="flex-end">
            <Button onClick={() => navigate(`/cars/${carId}/refuelings`)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>
              Save Refueling
            </Button>
          </Flex>
        </Form>
      </Spin>
    </Card>
  );
};
