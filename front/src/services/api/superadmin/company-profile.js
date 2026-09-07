import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.superadmin);

/**
 * The company's own profile — the branding and contact details that customer-
 * facing documents (invoice PDFs, notification emails) render.
 *
 * Addressed without a companyId: TERANETWORK runs as a single company with
 * several branches, so "the company" is unambiguous. Separate from the
 * companies CRUD, which manages the platform-side subscription record.
 */
export const getCompanyProfileApi = async () => {
  const response = await api.get("/api/v1/superadmin/companies/profile");
  return response.data;
};

export const updateCompanyProfileApi = async (profileData) => {
  const response = await api.put(
    "/api/v1/superadmin/companies/profile",
    profileData,
  );
  return response.data;
};
