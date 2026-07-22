import { z } from "zod";

// POST /check — check whether the current user holds a specific permission
export const checkPermissionSchema = z.object({
  module: z.string().min(1, "module is required").max(50),
  submodule: z.string().max(50).optional().nullable(),
  accessLevel: z.enum(["read", "write"]).optional().default("read"),
});
