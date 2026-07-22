import { useMutation } from "@tanstack/react-query";
import {
  forgotPasswordApi,
  resetPasswordApi,
  updateProfileApi,
  changePasswordApi,
} from "../api/account";

// portal: "admin" | "superadmin"

export const useForgotPassword = (portal) =>
  useMutation({ mutationFn: (email) => forgotPasswordApi(portal, email) });

export const useResetPassword = (portal) =>
  useMutation({ mutationFn: (payload) => resetPasswordApi(portal, payload) });

export const useUpdateProfile = (portal) =>
  useMutation({ mutationFn: (payload) => updateProfileApi(portal, payload) });

export const useChangePassword = (portal) =>
  useMutation({ mutationFn: (payload) => changePasswordApi(portal, payload) });
