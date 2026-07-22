import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(255),
});

// PUT /me — self-service profile update
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  phone: z.string().max(20).optional().nullable(),
  imageUrl: z.string().max(255).optional().nullable(),
});

// PUT /me/password — self-service password change
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(255),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(255),
});
