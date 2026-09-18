import { createAxiosInstanceWithInterceptor } from "./axios";

// Upload endpoints are shared across portals — use admin auth by default
// The caller can pass a userType if needed
const getUploadApi = (userType = "admin") =>
  createAxiosInstanceWithInterceptor("multipart", userType);

/**
 * Upload user avatar
 */
export const uploadAvatarApi = async (file, userType = "admin") => {
  const api = getUploadApi(userType);
  const formData = new FormData();
  formData.append("avatar", file);
  const response = await api.post("/api/v1/upload/avatar", formData);
  return response.data;
};

/**
 * Upload generic image
 */
export const uploadImageApi = async (file, userType = "admin") => {
  const api = getUploadApi(userType);
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/api/v1/upload/image", formData);
  return response.data;
};

/**
 * Delete uploaded file
 */
export const deleteFileApi = async (filePath, userType = "admin") => {
  const api = createAxiosInstanceWithInterceptor("data", userType);
  const response = await api.delete("/api/v1/upload/file", {
    data: { path: filePath },
  });
  return response.data;
};
