import { create } from "zustand";

/**
 * Imperative confirm dialog.
 *
 * `confirm(options)` returns a Promise<boolean> that resolves `true` when the
 * user confirms and `false` when they cancel or dismiss. It works from
 * anywhere (page hooks, event handlers, even non-React modules) because the
 * single <ConfirmDialog /> host mounted in App renders the actual dialog.
 *
 *   const ok = await confirm({
 *     title: "Delete role",
 *     description: `Delete "${name}"? This can't be undone.`,
 *     confirmText: "Delete",
 *     danger: true,
 *   });
 *   if (ok) doTheThing();
 *
 * Options: { title, description?, confirmText?, cancelText?, danger? }
 */
export const useConfirmStore = create((set, get) => ({
  open: false,
  options: {},
  _resolve: null,

  confirm: (options = {}) =>
    new Promise((resolve) => {
      set({ open: true, options, _resolve: resolve });
    }),

  // Called by the host on confirm / cancel / dismiss. Idempotent: the pending
  // promise is resolved once, then cleared so a trailing dismiss is a no-op.
  resolve: (result) => {
    get()._resolve?.(result);
    set({ open: false, _resolve: null });
  },
}));

/** Standalone helper so callers don't need the hook (works outside React too). */
export const confirm = (options) => useConfirmStore.getState().confirm(options);
