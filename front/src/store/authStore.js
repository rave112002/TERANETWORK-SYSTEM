import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Admin Auth Store
export const useAdminAuthStore = create(
  persist(
    (set) => ({
      userData: null,
      token: null,
      refreshToken: null,
      permissions: [],
      setToken: (token) => set({ token }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      setUserData: (userData) => set({ userData }),
      setUser: (userData) => set({ userData }), // Alias for compatibility
      setPermissions: (permissions) => set({ permissions }),
      reset: () =>
        set({
          userData: null,
          token: null,
          refreshToken: null,
          permissions: [],
        }),
    }),
    {
      name: "admin-auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// SuperAdmin Auth Store
export const useSuperAdminAuthStore = create(
  persist(
    (set) => ({
      userData: null,
      token: null,
      refreshToken: null,
      setToken: (token) => set({ token }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      setUserData: (userData) => set({ userData }),
      setUser: (userData) => set({ userData }), // Alias for compatibility
      reset: () => set({ userData: null, token: null, refreshToken: null }),
    }),
    {
      name: "superadmin-auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
