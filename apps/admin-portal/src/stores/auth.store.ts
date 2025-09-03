import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, AuthActions, LoginRequest } from '../types/auth';
import { authService } from '../services/auth.service';
import { TokenManager } from '../utils/token';

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authService.login(credentials);
          
          // Čuvanje tokena u localStorage
          TokenManager.setTokens(
            response.accessToken,
            response.refreshToken,
            response.expiresIn
          );

          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 'Greška prilikom prijave';
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });

        try {
          await authService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Čišćenje state-a i tokena
          TokenManager.clearTokens();
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshAccessToken: async (): Promise<boolean> => {
        const storedRefreshToken = TokenManager.getRefreshToken();
        
        if (!storedRefreshToken) {
          get().logout();
          return false;
        }

        try {
          const response = await authService.refreshToken(storedRefreshToken);
          
          // Ažuriranje tokena
          TokenManager.setTokens(
            response.accessToken,
            storedRefreshToken, // Refresh token ostaje isti
            response.expiresIn
          );

          set({
            user: response.user,
            accessToken: response.accessToken,
            isAuthenticated: true,
            error: null,
          });

          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
          return false;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      checkPermission: (permission: string): boolean => {
        const { user } = get();
        return user?.permissions?.includes(permission) || false;
      },

      hasRole: (role: string): boolean => {
        const { user } = get();
        return user?.roles?.includes(role) || false;
      },

      updateUser: (updatedUser: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...updatedUser }
          });
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Proverava da li su tokeni validni prilikom učitavanja
          const accessToken = TokenManager.getAccessToken();
          const refreshToken = TokenManager.getRefreshToken();
          
          if (accessToken && refreshToken && !TokenManager.isTokenExpired()) {
            state.accessToken = accessToken;
            state.refreshToken = refreshToken;
            state.isAuthenticated = true;
          } else if (refreshToken) {
            // Pokušaj refresh ako je access token istekao
            state.refreshAccessToken();
          } else {
            // Čisti state ako nema validnih tokena
            state.user = null;
            state.isAuthenticated = false;
            TokenManager.clearTokens();
          }
        }
      },
    }
  )
);