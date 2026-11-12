import path from "node:path";

export const mediaUploadDir = path.resolve(
  process.env["MEDIA_UPLOAD_DIR"] || path.join(process.cwd(), "uploads"),
);
