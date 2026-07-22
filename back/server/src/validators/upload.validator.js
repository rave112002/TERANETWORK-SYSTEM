import { z } from "zod";

// DELETE /file — delete a previously uploaded file
// (path-traversal + prefix checks are enforced in the controller)
export const deleteFileSchema = z.object({
  path: z.string().min(1, "File path is required").max(500),
});
