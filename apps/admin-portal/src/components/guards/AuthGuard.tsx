import React, { useEffect, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../../stores/auth.store';
import { TokenManager } from '../../utils/token';

interface AuthGuardProps {
  children: ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, refreshAccessToken, user } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      // Proverava da li je access token istekao i pokušava refresh
      if (!TokenManager.isTokenValid() && TokenManager.getRefreshToken()) {
        await refreshAccessToken();
      }
    };

    checkAuth();
  }, [refreshAccessToken]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  // Ako korisnik nije autentifikovan, preusmeri na login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Ako je korisnik neaktivan
  if (!user.isActive) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-red-600 mb-2">
            Nalog je deaktiviran
          </h2>
          <p className="text-gray-600">
            Vaš nalog je deaktiviran. Kontaktirajte administratora.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};