import { create } from 'zustand';

// Session storage helpers
const SS_STAFF_KEY = 'ohc_staff_user';
const SS_TENANT_KEY = 'ohc_tenant';

const loadFromSession = () => {
  try {
    const staffUser = JSON.parse(sessionStorage.getItem(SS_STAFF_KEY) || 'null');
    const tenant    = JSON.parse(sessionStorage.getItem(SS_TENANT_KEY) || 'null');
    return { staffUser, tenant };
  } catch {
    return { staffUser: null, tenant: null };
  }
};

const saveToSession = (staffUser, tenant) => {
  try {
    sessionStorage.setItem(SS_STAFF_KEY, JSON.stringify(staffUser));
    sessionStorage.setItem(SS_TENANT_KEY, JSON.stringify(tenant));
  } catch {}
};

const clearSession = () => {
  try {
    sessionStorage.removeItem(SS_STAFF_KEY);
    sessionStorage.removeItem(SS_TENANT_KEY);
  } catch {}
};

const { staffUser: savedStaff, tenant: savedTenant } = loadFromSession();

export const useAuthStore = create((set) => ({
  // Super Admin (Firebase Auth — persisted by Firebase SDK itself)
  superAdmin: null,
  setSuperAdmin: (superAdmin) => set({ superAdmin }),

  // Staff session (sessionStorage-backed)
  staffUser: savedStaff,
  setStaffUser: (staffUser) => {
    set((state) => {
      saveToSession(staffUser, state.tenant);
      return { staffUser };
    });
  },

  // Current tenant
  tenant: savedTenant,
  setTenant: (tenant) => {
    set((state) => {
      saveToSession(state.staffUser, tenant);
      return { tenant };
    });
  },

  // Loading state
  loading: true,
  setLoading: (loading) => set({ loading }),

  // Clear all on logout
  clearAll: () => {
    clearSession();
    set({ superAdmin: null, staffUser: null, tenant: null });
  },
}));
