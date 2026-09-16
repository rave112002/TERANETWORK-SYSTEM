import moment from "moment-timezone";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import APIError, { ERROR_CODES } from "../APIError.js";
import { catchAsync } from "../catchAsync.js";
const FILE_TYPE_CONFIGS = {
  images: {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
    "image/bmp": [".bmp"],
    "image/tiff": [".tiff", ".tif"],
    "image/heic": [".heic"],
    "image/heif": [".heif"],
  },
  documents: {
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "application/vnd.ms-excel": [".xls"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "text/plain": [".txt"],
    "text/csv": [".csv"],
  },
  audio: {
    "audio/mpeg": [".mp3"],
    "audio/wav": [".wav"],
    "audio/ogg": [".ogg"],
    "audio/aac": [".aac"],
  },
  video: {
    "video/mp4": [".mp4"],
    "video/quicktime": [".mov"],
    "video/x-msvideo": [".avi"],
    "video/webm": [".webm"],
  },
};

// Helper function to get allowed types from config
const getAllowedTypes = (fileTypes) => {
  const result = {};
  fileTypes.forEach((type) => {
    if (FILE_TYPE_CONFIGS[type]) {
      Object.assign(result, FILE_TYPE_CONFIGS[type]);
    }
  });
  return result;
};

// Helper function to validate file
const validateFile = (allowedTypes, mimeType, fileExt) => {
  if (!allowedTypes[mimeType]) {
    return { valid: false, error: `MIME type '${mimeType}' is not allowed` };
  }

  if (!allowedTypes[mimeType].includes(fileExt)) {
    return {
      valid: false,
      error: `Extension '${fileExt}' does not match MIME type '${mimeType}'. Expected: ${allowedTypes[
        mimeType
      ].join(", ")}`,
    };
  }

  return { valid: true };
};

// The only shape a path segment is ever allowed to take.
//
// Every segment of an upload path is a business ID (`companyId`, `branchId`,
// `accountId`) — and for SuperAdmin uploads the convention takes it from
// `req.body.companyId`, which is client-controlled. `path.join` resolves `..`
// happily, so an unchecked segment is an arbitrary-write primitive: a
// `companyId` of `../../../..` walks straight out of `public/`.
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

// `public/uploads`, absolute — the boundary nothing may be written outside of.
const UPLOAD_ROOT = path.resolve("public", "uploads");

/**
 * Resolve an upload destination, or throw.
 *
 * Exported so the guard can be tested directly — a path-traversal check that
 * only ever runs inside a multer callback is a check nobody can prove still
 * works.
 *
 * @param {string} relativePath e.g. `uploads/admin/avatars/{companyId}/{branchId}/{accountId}`
 * @returns {string} the absolute directory, guaranteed to sit under public/uploads
 */
export const resolveUploadDir = (relativePath) => {
  // Every segment must be a plain business ID. Checked before the join,
  // because after it the traversal has already happened. Splitting on "/" alone
  // is enough: SAFE_SEGMENT allows no backslash, so a Windows-style separator
  // smuggled into a segment fails the test below rather than slipping past it.
  const segments = String(relativePath).split("/").filter(Boolean);
  const unsafe = segments.find((segment) => !SAFE_SEGMENT.test(segment));
  if (unsafe !== undefined) {
    throw new APIError(
      `Invalid upload path segment: '${unsafe}'`,
      400,
      ERROR_CODES.VALIDATION_FAILED
    );
  }

  const destPath = path.resolve("public", ...segments);

  // Belt and braces: even with every segment clean, the result has to land
  // under public/uploads. A future filePath() that forgets the prefix fails
  // here rather than scattering files across the disk.
  if (destPath !== UPLOAD_ROOT && !destPath.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new APIError(
      "Upload path escapes the uploads directory",
      400,
      ERROR_CODES.VALIDATION_FAILED
    );
  }

  return destPath;
};

/**
 * Build a stored filename.
 *
 * 16 random bytes, not a hash of the clock. The previous name was
 * sha256(Date.now()) — one input, resolving to the same digest for every upload
 * in the same millisecond. That made stored files both collidable and
 * *enumerable*: `public/` is served without authentication, so anyone who could
 * guess a timestamp could walk out with the file behind it.
 */
export const buildUploadFilename = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const date = moment().format("YYYYMMDDHHmmss");
  return `${crypto.randomBytes(16).toString("hex")}${date}${ext}`;
};

const storage = (options) =>
  multer.diskStorage({
    destination: (req, _file, cb) => {
      let destPath;
      try {
        destPath = resolveUploadDir(options.filePath(req, _file));
      } catch (err) {
        return cb(err);
      }

      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }

      cb(null, destPath);
    },
    filename: (_req, file, cb) => {
      cb(null, buildUploadFilename(file.originalname));
    },
  });

const formatFileSize = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
};

const wrapMulterMethod = (multerInstance, method, options) =>
  (...args) => {
    const middleware = method.apply(multerInstance, args);
    return (req, res, next) => {
      middleware(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          const maxSize = options.maxFileSize || 1024 * 1024 * 3;
          const messages = {
            LIMIT_FILE_SIZE: `File too large. Maximum file size is ${formatFileSize(maxSize)}`,
            LIMIT_FILE_COUNT: "Too many files uploaded",
            LIMIT_UNEXPECTED_FILE: "Unexpected file field",
          };
          return next(new APIError(messages[err.code] || err.message, 400, ERROR_CODES.VALIDATION_FAILED));
        }
        if (err) return next(err);
        next();
      });
    };
  };

export const upload = (options) => {
  const multerInstance = multer({
    storage: storage(options),
    fileFilter: (_req, file, cb) => {
      const mimeType = file.mimetype;
      const fileExt = path.extname(file.originalname).toLowerCase();

      // If specific file types are defined, use them
      if (options.fileTypes) {
        const allowedTypes = getAllowedTypes(options.fileTypes);
        const validation = validateFile(allowedTypes, mimeType, fileExt);

        if (validation.valid) {
          cb(null, true);
        } else {
          cb(new APIError(validation.error, 400));
        }
      }
      // If custom allowedTypes object is provided (legacy support)
      else if (options.allowedTypes) {
        const validation = validateFile(options.allowedTypes, mimeType, fileExt);

        if (validation.valid) {
          cb(null, true);
        } else {
          cb(new APIError(validation.error, 400));
        }
      } else {
        cb(new APIError("Invalid file type", 400));
      }
    },
    limits: {
      fileSize: options.maxFileSize || 1024 * 1024 * 3, // Default 3MB, customizable
    },
  });

  return {
    single: wrapMulterMethod(multerInstance, multerInstance.single, options),
    array: wrapMulterMethod(multerInstance, multerInstance.array, options),
    fields: wrapMulterMethod(multerInstance, multerInstance.fields, options),
    none: wrapMulterMethod(multerInstance, multerInstance.none, options),
    any: wrapMulterMethod(multerInstance, multerInstance.any, options),
  };
};
/**
 * Compress uploaded images to reduce file size
 * Supports JPEG, PNG, WebP formats
 * Progressively reduces quality until target size is met
 */
export const compressImage = catchAsync(async (req, res, next) => {
  console.log("compressImage");
  if (!req.file) {
    return next();
  }

  const filePath = req.file.path;
  const mimeType = req.file.mimetype;
  const ext = path.extname(filePath).toLowerCase();

  // Only compress image files
  const compressibleImages = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
  };

  // Check if file type is compressible
  if (!compressibleImages[mimeType] || !compressibleImages[mimeType].includes(ext)) {
    return next();
  }

  try {
    let fileSize = fs.statSync(filePath).size;
    const targetSize = 1024 * 1024; // 1MB target
    let quality = 80; // Start with higher quality

    // Only compress if file is larger than target
    if (fileSize <= targetSize) {
      return next();
    }

    const tempPath = filePath.replace(ext, `-compressed${ext}`);

    // Compression loop with quality reduction
    while (fileSize > targetSize && quality >= 20) {
      // Delete previous temp file if exists
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      // Compress image based on format
      if (mimeType === "image/png") {
        await sharp(filePath).png({ quality, compressionLevel: 9 }).toFile(tempPath);
      } else if (mimeType === "image/webp") {
        await sharp(filePath).webp({ quality }).toFile(tempPath);
      } else {
        // JPEG/JPG
        await sharp(filePath).jpeg({ quality, mozjpeg: true }).toFile(tempPath);
      }

      fileSize = fs.statSync(tempPath).size;
      quality -= 10;
    }

    // Replace original with compressed version
    fs.unlinkSync(filePath);
    fs.renameSync(tempPath, filePath);

    // Update req.file with new size
    req.file.size = fs.statSync(filePath).size;
  } catch (error) {
    // If compression fails, continue with original file
    console.error("Image compression failed:", error);
    // Clean up temp file if exists
    const tempPath = filePath.replace(ext, `-compressed${ext}`);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }

  next();
});
