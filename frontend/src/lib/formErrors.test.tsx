import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { Form, Input, type FormInstance } from 'antd';
import { applyServerErrors } from './formErrors';

// Renders a form with one registered field, "email", and hands its instance to onReady.
const renderForm = () => {
  let form!: FormInstance;
  const Harness = ({ onReady }: { onReady: (form: FormInstance) => void }) => {
    const [formInstance] = Form.useForm();
    useEffect(() => onReady(formInstance), [formInstance, onReady]);
    return (
      <Form form={formInstance}>
        <Form.Item name="email" label="Email">
          <Input />
        </Form.Item>
      </Form>
    );
  };
  render(<Harness onReady={(instance) => { form = instance; }} />);
  return form;
};

describe('applyServerErrors', () => {
  it('sets the error on a registered field and returns null', () => {
    const form = renderForm();

    const topError = applyServerErrors(form, { email: 'Email already taken' }, 'Registration failed');

    expect(form.getFieldError('email')).toEqual(['Email already taken']);
    expect(topError).toBeNull();
  });

  it('returns the message for keys that match no field', () => {
    const form = renderForm();

    const topError = applyServerErrors(form, { unknown: 'Nope' }, 'Something failed');

    expect(form.getFieldError('email')).toEqual([]);
    expect(topError).toBe('Something failed');
  });

  it('maps known keys and returns the message when some keys are unknown', () => {
    const form = renderForm();

    const topError = applyServerErrors(form, { email: 'Bad email', unknown: 'Nope' }, 'Invalid');

    expect(form.getFieldError('email')).toEqual(['Bad email']);
    expect(topError).toBe('Invalid');
  });

  it('returns the message when there are no fields at all', () => {
    const form = renderForm();

    expect(applyServerErrors(form, undefined, 'Invalid credentials')).toBe('Invalid credentials');
    expect(applyServerErrors(form, {}, 'Invalid credentials')).toBe('Invalid credentials');
  });
});
