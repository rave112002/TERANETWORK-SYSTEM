import client from "./client";

/**
 * A branch's company profile, read and changed on that branch through
 * superadmin-server (D10). Nothing is kept centrally.
 */

export const getCompanyProfileApi = async (branchId) => {
  const response = await client.get(`/branches/${branchId}/company-profile`);
  return response.data;
};

/** @param {{branchId: string, name: string, email: string, phone?: string|null, website?: string|null, address?: string|null, tin?: string|null}} data */
export const updateCompanyProfileApi = async ({ branchId, ...data }) => {
  const response = await client.put(`/branches/${branchId}/company-profile`, data);
  return response.data;
};

/** @param {{branchId: string, file: File}} args  PNG or JPG, 2 MB at most */
export const uploadCompanyLogoApi = async ({ branchId, file }) => {
  const form = new FormData();
  form.append("logo", file);
  const response = await client.put(`/branches/${branchId}/company-profile/logo`, form);
  return response.data;
};

export const removeCompanyLogoApi = async (branchId) => {
  const response = await client.delete(`/branches/${branchId}/company-profile/logo`);
  return response.data;
};

/** For an <img src>: same origin, so the session cookie goes with it. */
export const companyLogoUrl = (branchId, logoVersion) =>
  `/api/branches/${branchId}/company-profile/logo?v=${encodeURIComponent(logoVersion ?? "")}`;
