import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ApiError } from '../api/types';
import { useAuth } from '../auth/AuthProvider';

export const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors(null);
    setIsSubmitting(true);

    try {
      const response = await api.auth.register({ email, password });
      login(response.user);
      navigate('/cars');
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      setFieldErrors(err.fields || null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={!!fieldErrors?.email}
            aria-describedby={fieldErrors?.email ? `email-error` : undefined}
          />
          {fieldErrors?.email && <span id="email-error" className="field-error">{fieldErrors.email}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-invalid={!!fieldErrors?.password}
            aria-describedby={fieldErrors?.password ? `password-error` : undefined}
          />
          {fieldErrors?.password && <span id="password-error" className="field-error">{fieldErrors.password}</span>}
        </div>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Registering...' : 'Register'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
};
