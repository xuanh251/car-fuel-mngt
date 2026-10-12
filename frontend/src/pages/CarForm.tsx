import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Flex, Form, Input, InputNumber, Row, Select, Spin, Typography } from 'antd';
import { api } from '../api/client';
import type { CarInput, ApiError } from '../api/types';
import { applyServerErrors } from '../lib/formErrors';

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
  const [form] = Form.useForm<CarInput>();

  // Edit pages start in the loading state; the effect clears it once the car is fetched.
  const [isLoadingRecord, setIsLoadingRecord] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && carId) {
      api.cars.get(Number(carId))
        .then((car) => {
          form.setFieldsValue({
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
        .catch((e: any) => setFormError(e.message))
        .finally(() => setIsLoadingRecord(false));
    }
  }, [carId, isEdit, form]);

  const handleFinish = async (values: CarInput) => {
    setFormError(null);
    setIsSaving(true);

    // Empty optional numbers are left out of the payload, not sent as null.
    const body: CarInput = {
      name: values.name,
      make: values.make ?? '',
      model: values.model ?? '',
      year: values.year ?? undefined,
      licensePlate: values.licensePlate ?? '',
      fuelType: values.fuelType,
      tankCapacityL: values.tankCapacityL ?? undefined,
      initialOdometerKm: values.initialOdometerKm,
    };

    try {
      if (isEdit && carId) {
        await api.cars.update(Number(carId), body);
      } else {
        await api.cars.create(body);
      }
      navigate('/cars');
    } catch (e) {
      const err = e as ApiError;
      setFormError(applyServerErrors(form, err.fields, err.message));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card style={{ maxWidth: 720, margin: '0 auto' }}>
      <Typography.Title level={2}>{isEdit ? 'Edit Car' : 'Add Car'}</Typography.Title>
      {formError && <Alert type="error" message={formError} showIcon style={{ marginBottom: 16 }} />}
      <Spin spinning={isLoadingRecord}>
        <Form
          form={form}
          name="car"
          layout="vertical"
          initialValues={{ make: '', model: '', licensePlate: '', fuelType: 'petrol', initialOdometerKm: 0 }}
          onFinish={handleFinish}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter a name' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="make" label="Make">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="model" label="Model">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="year" label="Year">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="licensePlate" label="License Plate">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="fuelType" label="Fuel Type" rules={[{ required: true, message: 'Please select a fuel type' }]}>
                <Select options={FUEL_TYPES} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="tankCapacityL" label="Tank Capacity (L)">
                <InputNumber step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="initialOdometerKm"
                label="Initial Odometer (km)"
                rules={[{ required: true, message: 'Please enter the initial odometer' }]}
              >
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Flex gap="small" justify="flex-end">
            <Button onClick={() => navigate('/cars')} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>
              Save Car
            </Button>
          </Flex>
        </Form>
      </Spin>
    </Card>
  );
};
