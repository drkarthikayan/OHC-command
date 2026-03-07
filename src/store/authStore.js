import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  // Super Admin (Firebase Auth)
  superAdmin: null,
  setSuperAdmin: (superAdmin) => set({ superAdmin }),

  // Staff session (Firestore-based)
  staffUser: null,
  setStaffUser: (staffUser) => set({ staffUser }),

  // Current tenant
  tenant: null,
  setTenant: (tenant) => set({ tenant }),

  // Loading state
  loading: true,
  setLoading: (loading) => set({ loading }),

  // Clear all on logout
  clearAll: () => set({ superAdmin: null, staffUser: null, tenant: null }),
}));
