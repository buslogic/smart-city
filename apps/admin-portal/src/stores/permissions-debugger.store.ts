import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PermissionsDebuggerState, PermissionDebugInfo } from '../types/permissions-debugger';
import { permissionsDebuggerService } from '../services/permissions-debugger.service';

interface PermissionsDebuggerStore extends PermissionsDebuggerState {
  // Actions
  setOpen: (isOpen: boolean) => void;
  setEnabled: (isEnabled: boolean) => void;
  setActiveTab: (tab: PermissionsDebuggerState['activeTab']) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  fetchDebugInfo: (currentRoute?: string) => Promise<void>;
  reset: () => void;
}

const initialState: PermissionsDebuggerState = {
  isOpen: false,
  isEnabled: import.meta.env.VITE_ENABLE_PERMISSIONS_DEBUGGER === 'true' || import.meta.env.DEV,
  debugInfo: null,
  loading: false,
  error: null,
  activeTab: 'current',
  searchQuery: '',
  selectedCategory: null,
};

export const usePermissionsDebuggerStore = create<PermissionsDebuggerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setOpen: (isOpen) => set({ isOpen }),
      
      setEnabled: (isEnabled) => set({ isEnabled }),
      
      setActiveTab: (activeTab) => set({ activeTab }),
      
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      
      setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
      
      fetchDebugInfo: async (currentRoute) => {
        set({ loading: true, error: null });
        try {
          const debugInfo = await permissionsDebuggerService.getDebugInfo(currentRoute);
          set({ debugInfo, loading: false });
        } catch (error: any) {
          set({ 
            error: error.response?.data?.message || 'Greška pri učitavanju debug informacija', 
            loading: false 
          });
        }
      },
      
      reset: () => set(initialState),
    }),
    {
      name: 'permissions-debugger',
      partialize: (state) => ({
        isEnabled: state.isEnabled,
      }),
    }
  )
);