import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { api } from '../api/client';
import type { ApiError } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { applyServerErrors } from '../lib/formErrors';

export const Login = () => {
  const [form] = Form.useForm();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleFinish = async (values: { email: string; password: string }) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      const response = await api.auth.login({ email: values.email, password: values.password });
      login(response.user);
      navigate('/cars');
    } catch (e) {
      const err = e as ApiError;
      setFormError(applyServerErrors(form, err.fields, err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Typography.Title level={1} style={{ textAlign: 'center' }}>Login</Typography.Title>
        {formError && <Alert type="error" message={formError} showIcon style={{ marginBottom: 16 }} />}
        <Form form={form} name="login" layout="vertical" onFinish={handleFinish}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input type="email" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={isSubmitting}>
              Login
            </Button>
          </Form.Item>
        </Form>
        <Typography.Paragraph style={{ textAlign: 'center', marginBottom: 0 }}>
          Don't have an account? <Link to="/register">Register</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
};
