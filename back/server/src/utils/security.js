// security.js
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import sanitizeHtml from "sanitize-html";

// =========================
// 1) Sanitization middleware
// =========================
const allowHtmlFields = new Set(["description", "content"]); // example

// Configure sanitization rules
const defaultSanitizeOpts = { allowedTags: [], allowedAttributes: {} }; // plain text
const richSanitizeOpts = {
  allowedTags: ["b", "i", "em", "strong", "a", "ul", "ol", "li", "p", "br"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
};

// Sanitize a single value
function sanitizeValue(value, mode = "plain") {
  if (typeof value !== "string") return value;

  // Remove zero-width/invisible chars
  const newValue = value.replaceAll(/[\u200B-\u200D\uFEFF]/g, "");

  // Apply sanitization based on mode
  const opts = mode === "rich" ? richSanitizeOpts : defaultSanitizeOpts;
  let clean = sanitizeHtml(newValue, opts);

  // Normalize CRLF and collapse spaces
  clean = clean
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll(/\s+/g, " "))
    .join("\n");

  // Convert empty string to null
  return clean.length === 0 ? null : clean;
}

// Recursively sanitize an object/array
function purifyReqBody(obj, fieldModes = {}) {
  if (Array.isArray(obj)) {
    return obj.map((v) => purifyReqBody(v, fieldModes));
  }

  if (obj && typeof obj === "object") {
    for (const key in obj) {
      const mode =
        fieldModes[key] || (allowHtmlFields.has(key) ? "rich" : "plain");

      if (typeof obj[key] === "string") {
        obj[key] = sanitizeValue(obj[key], mode);
      } else if (obj[key] && typeof obj[key] === "object") {
        obj[key] = purifyReqBody(obj[key], fieldModes);
      }
    }
    return obj;
  }

  return obj;
}

// =========================
// 2) Helmet + CORS for API
// =========================
function isSameOrigin(origin, host) {
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function securityHeaders(options = {}) {
  const {
    isDevelopment = process.env.NODE_ENV === "development",
    allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:3000"],
    enableCSP = true,
  } = options;
  return [
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin" },

      xContentTypeOptions: true, // X-Content-Type-Options: nosniff
      frameguard: { action: "deny" }, // X-Frame-Options: DENY

      // HTTP Strict Transport Security (HSTS)
      hsts: isDevelopment
        ? false
        : {
            maxAge: 63072000, // 2 years in seconds
            includeSubDomains: true,
            preload: true,
          },

      // Expect-CT header (deprecated but still useful for older browsers)
      expectCt: isDevelopment ? false : { maxAge: 86400, enforce: true },

      // Referrer Policy - control referrer information
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },

      // DNS Prefetch Control - prevent DNS prefetching
      dnsPrefetchControl: { allow: false },

      // Permitted Cross-Domain Policies (for Adobe products)
      permittedCrossDomainPolicies: { permittedPolicies: "none" },

      // X-Download-Options for IE8+
      ieNoOpen: true,

      // Hide X-Powered-By header (already set in express, but helmet ensures it)
      hidePoweredBy: true,

      // Content Security Policy
      contentSecurityPolicy: enableCSP
        ? {
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
              manifestSrc: ["'self'"],
              objectSrc: ["'none'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline for inline styles if needed
              imgSrc: ["'self'", "data:", "https:"],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", "data:"], // Vite inlines small font files as data: URLs
              mediaSrc: ["'self'"],
              // The invoice PDF drawer shows a blob: URL in an iframe.
              frameSrc: ["'self'", "blob:"],
              // Only when this server itself speaks HTTPS (certPath set). A
              // branch serves plain HTTP on :8787 — over Tailscale too — and
              // there this rewrites every script and API call to https:// and
              // the app stops loading.
              //
              // `null`, not "omitted": helmet merges these directives over its
              // own defaults, and `upgrade-insecure-requests` is one of them —
              // leaving the key out keeps the default, so it has to be
              // explicitly cancelled.
              upgradeInsecureRequests: process.env.certPath ? [] : null,
            },
          }
        : false,
    }),

    // Custom Permissions-Policy header (replaces Feature-Policy)
    (req, res, next) => {
      res.setHeader(
        "Permissions-Policy",
        [
          "geolocation=()",
          "microphone=()",
          "camera=()",
          "payment=()",
          "usb=()",
          "magnetometer=()",
          "gyroscope=()",
          "accelerometer=()",
          "ambient-light-sensor=()",
          "autoplay=()",
          "encrypted-media=()",
          "fullscreen=(self)",
          "picture-in-picture=()",
        ].join(", ")
      );
      next();
    },
    // A delegate, so the origin check can see the request's own Host.
    cors((req, delegate) => delegate(null, {
      origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, curl, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Same origin: the page was served by this server (production — Express
        // serves the built app on the same port). Browsers still send Origin
        // on every POST/PUT/DELETE and on <script type="module">, so without
        // this the app would be refused by its own server — and the address
        // differs per branch and per access path (localhost, Tailscale IP),
        // so it can't just be listed in FRONTEND_URL.
        if (isSameOrigin(origin, req.headers.host)) {
          return callback(null, true);
        }

        if (isDevelopment) {
          // Allow all origins in development (Hoppscotch, Postman web, etc.)
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS policy"));
        }
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Cache-Control",
        "X-CSRF-Token",
      ],
      exposedHeaders: [
        "Content-Range",
        "X-Total-Count",
        "X-Rate-Limit-Remaining",
        "X-Rate-Limit-Reset",
      ],
      maxAge: 86400, // Cache preflight for 24 hours
    })),
    hpp(),
  ];
}

// =========================
// 3) Sanitization middleware export
// =========================
export const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = purifyReqBody(req.body);
  }
  next();
};
