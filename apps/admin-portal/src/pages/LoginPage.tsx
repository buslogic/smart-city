import React from 'react';
import { Navigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { useAuthStore } from '../stores/auth.store';

export const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  // Ako je korisnik već ulogovan, preusmeri ga na dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <LoginForm onSuccess={() => window.location.href = '/'} />
  );
};