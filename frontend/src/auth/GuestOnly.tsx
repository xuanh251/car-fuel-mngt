import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export const GuestOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  // location removed as unused

  if (isLoading) return null;

  if (user) {
    return <Navigate to="/cars" replace />;
  }

  return <>{children}</>;
};
