import { getSetting, parseBoolean, SETTING_KEYS } from "./settings.service.js";

/**
 * The network switch — one branch setting, `NETWORK_ENABLED`, that decides
 * whether this installation runs the network side of the system (D11).
 *
 * Off means billing only: customers, plans, subscriptions, invoices and
 * payments, with no OLT, no modems and no disconnections. On is the full system.
 *
 * ── Why it is enforced here and not by editing roles ────────────────────────
 *
 * Turning it off removes the Network and Dunning permissions from everyone, in
 * {@link checkPermission} and in the permission list the Admin portal builds
 * its menu from. The roles themselves are untouched, so turning it back on
 * restores exactly what each role had — nobody has to remember what to re-grant.
 *
 * ── Who can change it ───────────────────────────────────────────────────────
 *
 * Only the central SuperAdmin, over the management API. The branch's own
 * Admin → System screen can read it but its update schema refuses the key.
 */

/**
 * Is the network side of the system on for this branch?
 *
 * Unrecognised values read as ON: the full system is the one every branch ran
 * before this setting existed, so a typo must not quietly switch it off.
 *
 * @param {Object} db
 * @param {string} companyId
 * @returns {Promise<boolean>}
 */
export const isNetworkEnabled = async (db, companyId) =>
  parseBoolean(await getSetting(db, companyId, SETTING_KEYS.NETWORK_ENABLED), true);

/**
 * Does this permission belong to the network side?
 *
 * Network inventory and provisioning (`network/*`) and the disconnection sweep
 * (`billing/dunning`). Everything else in billing stays.
 *
 * @param {string} module
 * @param {string|null} submodule
 */
export const isNetworkPermission = (module, submodule) =>
  module === "network" || (module === "billing" && submodule === "dunning");

export const NETWORK_OFF_MESSAGE =
  "Network features are turned off for this branch. They can be turned on from the central SuperAdmin.";
