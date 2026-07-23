import { decodeHTML } from "./decode-html";

/**
 * Philippine address helpers.
 *
 * ⚠️ The reference data (`assets/address/*.json`) is ~6.6 MB — `refbrgy.json`
 * alone is 6.3 MB. It is therefore **lazy-loaded** via a dynamic import so it is
 * code-split into its own chunk and only fetched the first time a code→name
 * lookup actually runs. Never statically `import` from `assets/address` in a
 * page/hook: that pulls the whole dataset into that page's bundle.
 *
 * Consequence: every code-based lookup below is **async**.
 */

let dataPromise = null;

/** Load (once) and cache the reference tables. */
const loadAddressData = () => {
  if (!dataPromise) {
    dataPromise = import("../assets/address");
  }
  return dataPromise;
};

/** Warm the cache ahead of time (e.g. when an address form mounts). */
export const preloadAddressData = () => loadAddressData();

/**
 * Format an address from already-resolved text values. Needs no reference data,
 * so this one stays synchronous.
 */
export const formatAddress = ({
  address1,
  address2,
  city,
  province,
  region,
  zipCode,
}) => {
  return [
    address1 ? `${address1},` : "",
    address2 ? `${address2},` : "",
    city ? `${city},` : "",
    province ? `${province},` : "",
    region ? `${region},` : "",
    zipCode || "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/,\s*$/, "");
};

/**
 * Capitalize first letter of a string
 */
export const capitalizeFirstLetter = (string) => {
  if (!string) return "";
  return string?.charAt(0).toUpperCase() + string?.slice(1);
};

/**
 * Format an address from PSGC codes. Async — loads the reference data on demand.
 * @returns {Promise<string>}
 */
export const formatAddressByCode = async ({
  address1,
  address2,
  brgy,
  city,
  province,
  region,
  zipCode,
}) => {
  // Nothing to resolve → don't pay for the dataset at all
  if (!brgy && !city && !province && !region) {
    return formatAddress({ address1, address2, zipCode });
  }

  const { refbrgy, refcitymun, refprovince, refregion } = await loadAddressData();

  return decodeHTML(
    [
      address1 ? `${address1},` : "",
      address2 ? `${address2},` : "",
      brgy ? `${refbrgy?.find((i) => i.brgyCode === brgy)?.brgyDesc},` : "",
      city ? `${refcitymun?.find((i) => i.citymunCode === city)?.citymunDesc},` : "",
      province
        ? `${refprovince?.find((i) => i.provCode === province)?.provDesc},`
        : "",
      region ? `${refregion?.find((i) => i.regCode === region)?.regDesc},` : "",
      zipCode || "",
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/,\s*$/, ""),
  );
};

// ─── Code → record lookups (async) ──────────────────────────────────────────

export const getRegionByCode = async (regCode) => {
  const { refregion } = await loadAddressData();
  return refregion?.find((i) => i.regCode === regCode);
};

export const getProvinceByCode = async (provCode) => {
  const { refprovince } = await loadAddressData();
  return refprovince?.find((i) => i.provCode === provCode);
};

export const getCityMunByCode = async (citymunCode) => {
  const { refcitymun } = await loadAddressData();
  return refcitymun?.find((i) => i.citymunCode === citymunCode);
};

export const getBarangayByCode = async (brgyCode) => {
  const { refbrgy } = await loadAddressData();
  return refbrgy?.find((i) => i.brgyCode === brgyCode);
};

// ─── Cascading option lists (async) ─────────────────────────────────────────

export const getRegions = async () => {
  const { refregion } = await loadAddressData();
  return refregion || [];
};

export const getProvincesByRegion = async (regCode) => {
  const { refprovince } = await loadAddressData();
  return refprovince?.filter((i) => i.regCode === regCode) || [];
};

export const getCitiesByProvince = async (provCode) => {
  const { refcitymun } = await loadAddressData();
  return refcitymun?.filter((i) => i.provCode === provCode) || [];
};

export const getBarangaysByCity = async (citymunCode) => {
  const { refbrgy } = await loadAddressData();
  return refbrgy?.filter((i) => i.citymunCode === citymunCode) || [];
};
