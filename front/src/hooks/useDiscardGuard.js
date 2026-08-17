import { useCallback, useEffect, useRef } from "react";
import { confirm } from "../store/confirmStore";

/**
 * Ask before closing a form drawer that has been changed.
 *
 * No new dialog: `confirm()` already returns a `Promise<boolean>` from a single
 * mounted host, so this is a caller, not a component.
 *
 * ── The thing that makes this worse than nothing if it's got wrong ──────────
 *
 * `isDirty` is a **comparison against `defaultValues`**, not a record of typing.
 * A drawer whose `form.reset()` and whose zod schema disagree about the field
 * list is therefore **dirty the moment it opens** — and the guard would then
 * fire every time anyone closed a form they never touched. People learn to
 * click through it within a day, and it stops protecting anything.
 *
 * So the hook asserts it, in development: one tick after opening (after the
 * drawer's own `reset()` effect has run) a still-dirty form logs a warning
 * naming the drawer. The fix belongs in that drawer — a field the schema
 * declares and `reset()` omits arrives as `undefined`, which also makes the
 * resolver reject the form so Save silently does nothing.
 *
 *   const { guardedClose, markSaved } = useDiscardGuard({
 *     open,
 *     isDirty,
 *     isSubmitSuccessful,
 *     noun: "role",
 *     onClose: handleClose,   // the drawer's own reset-then-close
 *   });
 *
 * Give `guardedClose` to `onOpenChange`, to the header X **and** to the footer
 * Cancel alike — `<Sheet>` routes the X, Escape and the overlay click all
 * through `onOpenChange`, and a guard on one of the three is a guard on none.
 *
 * @param {object}   options
 * @param {boolean}  options.open      is the drawer open
 * @param {boolean}  options.isDirty   react-hook-form's `formState.isDirty`, or any
 *   equivalent flag for a drawer that isn't a react-hook-form (a permissions matrix)
 * @param {boolean}  [options.isSubmitSuccessful] react-hook-form's flag of the same
 *   name. Pass it: after a save the PARENT closes the drawer, which reaches
 *   `onOpenChange` with the form still dirty, and without this the dialog fires on a
 *   successful save. Note this repo's drawers swallow mutation errors in a `catch`,
 *   which leaves the flag `true` even when the API rejected — so call `markSaved()`
 *   on the success path too, which is what actually gates it.
 * @param {string}   options.noun      "role", "user", "company" — used in the copy
 * @param {() => void} options.onClose what to call once discarding is agreed
 * @param {string}   [options.label]   how to name this form in the dev warning
 */
export const useDiscardGuard = ({
  open,
  isDirty,
  isSubmitSuccessful = false,
  noun,
  onClose,
  label,
}) => {
  const getIsDirty = useCallback(() => isDirty, [isDirty]);

  /**
   * Set by `markSaved()` so a successful save never asks. A ref rather than
   * state: it's read inside the close handler in the same tick, and a
   * re-render would be too late.
   */
  const savedRef = useRef(false);

  useEffect(() => {
    if (open) savedRef.current = false;
  }, [open]);

  /**
   * The dev-time assertion. Runs one tick after opening so react-hook-form has
   * applied the `reset()` the drawer runs in its own effect — checking
   * synchronously would report every form as dirty and be worse than useless.
   */
  useEffect(() => {
    if (!open || !import.meta.env.DEV) return undefined;
    // `getIsDirty` rather than a ref: the assertion needs the value AFTER the
    // drawer's reset() effect, and reading a live getter keeps this effect keyed
    // on `open` alone — it must run once per open, not on every keystroke.
    const t = setTimeout(() => {
      if (getIsDirty()) {
        console.warn(
          `[useDiscardGuard] "${label ?? noun}" is DIRTY on open.\n` +
            "  Its zod schema and its form.reset() disagree about the field list, so the\n" +
            "  discard dialog will fire even when nothing was touched. Fix the drawer —\n" +
            "  don't exempt it: the same mismatch also makes the resolver reject the form,\n" +
            "  so Save does nothing at all, silently.",
        );
      }
    }, 0);
    return () => clearTimeout(t);
  }, [open, label, noun, getIsDirty]);

  /** Wrap the drawer's own close. Give this to onOpenChange, the X and Cancel. */
  const guardedClose = useCallback(async () => {
    if (savedRef.current || isSubmitSuccessful || !isDirty) {
      onClose();
      return;
    }
    const ok = await confirm({
      title: "Discard your changes?",
      description: `You have unsaved changes to this ${noun}. Closing now loses them — there is no undo.`,
      confirmText: "Discard changes",
      cancelText: "Keep editing",
      danger: true,
    });
    if (ok) onClose();
  }, [isDirty, isSubmitSuccessful, noun, onClose]);

  /**
   * Call on the success path of `onSubmit`, before handing back to the parent.
   * The parent is what closes the drawer, so this is how the guard learns the
   * changes were written rather than abandoned.
   */
  const markSaved = useCallback(() => {
    savedRef.current = true;
  }, []);

  /** Close immediately, without asking — `markSaved()` plus the close. */
  const closeAfterSave = useCallback(() => {
    savedRef.current = true;
    onClose();
  }, [onClose]);

  return { guardedClose, markSaved, closeAfterSave };
};

export default useDiscardGuard;
