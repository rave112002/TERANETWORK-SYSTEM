import { refbrgy, refcitymun, refprovince, refregion } from "../assets/address";
import { decodeHTML } from "./decode-html";

/**
 * Format address from full text values
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
 * Format address from codes (brgyCode, citymunCode, provCode, regCode)
 */
export const formatAddressByCode = ({
  address1,
  address2,
  brgy,
  city,
  province,
  region,
  zipCode,
}) => {
  return decodeHTML(
    [
      address1 ? `${address1},` : "",
      address2 ? `${address2},` : "",
      brgy
        ? `${refbrgy?.find((item) => item.brgyCode === brgy)?.brgyDesc},`
        : "",
      city
        ? `${refcitymun?.find((item) => item.citymunCode === city)?.citymunDesc},`
        : "",
      province
        ? `${refprovince?.find((item) => item.provCode === province)?.provDesc},`
        : "",
      region
        ? `${refregion?.find((item) => item.regCode === region)?.regDesc},`
        : "",
      zipCode || "",
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/,\s*$/, ""),
  );
};

/**
 * Get region by code
 */
export const getRegionByCode = (regCode) => {
  return refregion?.find((item) => item.regCode === regCode);
};

/**
 * Get province by code
 */
export const getProvinceByCode = (provCode) => {
  return refprovince?.find((item) => item.provCode === provCode);
};

/**
 * Get city/municipality by code
 */
export const getCityMunByCode = (citymunCode) => {
  return refcitymun?.find((item) => item.citymunCode === citymunCode);
};

/**
 * Get barangay by code
 */
export const getBarangayByCode = (brgyCode) => {
  return refbrgy?.find((item) => item.brgyCode === brgyCode);
};

/**
 * Get provinces by region code
 */
export const getProvincesByRegion = (regCode) => {
  return refprovince?.filter((item) => item.regCode === regCode) || [];
};

/**
 * Get cities/municipalities by province code
 */
export const getCitiesByProvince = (provCode) => {
  return refcitymun?.filter((item) => item.provCode === provCode) || [];
};

/**
 * Get barangays by city/municipality code
 */
export const getBarangaysByCity = (citymunCode) => {
  return refbrgy?.filter((item) => item.citymunCode === citymunCode) || [];
};
