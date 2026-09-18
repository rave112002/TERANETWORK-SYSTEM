import express from "express";
import fs from "node:fs";
import path from "node:path";
import { catchAsync, validateBody } from "../../../utils/catchAsync.js";
import { upload, compressImage } from "../../../utils/file/uploads.js";
import APIError from "../../../utils/APIError.js";
import { deleteFileSchema } from "../../../validators/upload.validator.js";

const router = express.Router();

// ─── Upload configurations ──────────────────────────────────────────────────

// The company logo is uploaded through the management API from the central
// SuperAdmin (controllers/v1/manage/company.controller.js, D10), not here.

// Admin — user avatar: uploads/admin/avatars/{companyId}/{branchId}/{accountId}/
const adminAvatarUpload = upload({
  filePath: (req) => {
    const { companyId, branchId, accountId } = req.user;
    return `uploads/admin/avatars/${companyId}/${branchId}/${accountId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 2, // 2MB
});

// Admin — general image: uploads/admin/images/{companyId}/{branchId}/
const adminImageUpload = upload({
  filePath: (req) => {
    const { companyId, branchId } = req.user;
    return `uploads/admin/images/${companyId}/${branchId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 5, // 5MB
});

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /avatar
 * Upload user avatar (Admin context)
 * Path: uploads/admin/avatars/{companyId}/{branchId}/{accountId}/
 */
router.post(
  "/avatar",
  adminAvatarUpload.single("avatar"),
  compressImage,
  catchAsync(async (req, res) => {
    if (!req.file) {
      throw new APIError("No file uploaded", 400);
    }

    const filePath = `/${req.file.path.replace(/\\/g, "/")}`;

    return res.sendSuccess("Avatar uploaded successfully", {
      path: filePath,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  })
);

/**
 * POST /image
 * Upload general image (Admin context)
 * Path: uploads/admin/images/{companyId}/{branchId}/
 */
router.post(
  "/image",
  adminImageUpload.single("file"),
  compressImage,
  catchAsync(async (req, res) => {
    if (!req.file) {
      throw new APIError("No file uploaded", 400);
    }

    const filePath = `/${req.file.path.replace(/\\/g, "/")}`;

    return res.sendSuccess("Image uploaded successfully", {
      path: filePath,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  })
);

/**
 * DELETE /file
 * Delete an uploaded file from the server
 */
router.delete(
  "/file",
  validateBody(deleteFileSchema),
  catchAsync(async (req, res) => {
    const { path: filePath } = req.body;

    // Security: prevent path traversal
    const normalizedPath = path.normalize(filePath).replace(/^\/+/, "");
    if (normalizedPath.includes("..") || !normalizedPath.startsWith("public/uploads/")) {
      throw new APIError("Invalid file path", 400);
    }

    const absolutePath = path.resolve(normalizedPath);

    if (!fs.existsSync(absolutePath)) {
      throw new APIError("File not found", 404);
    }

    fs.unlinkSync(absolutePath);

    return res.sendSuccess("File deleted successfully");
  })
);

export default router;
