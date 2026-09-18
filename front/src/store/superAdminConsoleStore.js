import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Who is logged in to the central SuperAdmin app (docs/decisions.md D10).
 *
 * The session itself is an httpOnly cookie set by superadmin-server, which
 * script cannot read. This store only remembers that a login happened and who
 * it was, so the route guards and the sidebar footer can work. `token` is a
 * marker, not a credential: the shared `Auth`/`UnAuth` guards check that field.
 * A 401 from the server clears it (services/api/superadmin-console/client.js).
 */
export const useSuperAdminConsoleStore = create(
  persist(
    (set) => ({
      token: null,
      userData: null,
      company: null,
      setSession: (userData) => set({ token: "session", userData }),
      reset: () => set({ token: null, userData: null }),
    }),
    {
      name: "superadmin-console",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useSuperAdminConsoleStore;
