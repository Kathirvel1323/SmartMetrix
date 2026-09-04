import multer, { StorageEngine, FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Upload directory — ignored in .gitignore
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/inspections');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

// Safe server-side storage: UUID-based filenames, never trust original names
const storage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_EXTENSIONS[file.mimetype] || '.bin';
    const safeFilename = `${uuidv4()}${ext}`;
    cb(null, safeFilename);
  }
});

// MIME-type file filter — initial reject of unsupported types
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err: any = new Error(
      `Unsupported file type: ${file.mimetype}. Only JPEG, PNG and WebP are accepted.`
    );
    err.statusCode = 400;
    cb(err);
  }
};

// Configurable limits with safe defaults
const MAX_FILES = parseInt(process.env.MAX_EVIDENCE_FILES || '5', 10);
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_EVIDENCE_SIZE_MB || '5', 10);

export const evidenceUpload = multer({
  storage,
  fileFilter,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
  }
});

/**
 * Validates actual file signatures / magic bytes:
 * - JPEG: FF D8 FF
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 * - WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
 */
export const detectImageSignature = (buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null => {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
};

/**
 * Inspects all uploaded files on disk for real image magic bytes.
 * If signature verification fails, all files are immediately removed.
 */
export const validateUploadedImageFiles = async (files: Express.Multer.File[]): Promise<void> => {
  for (const file of files) {
    let fd: number | null = null;
    try {
      const buffer = Buffer.alloc(16);
      fd = fs.openSync(file.path, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);
      fd = null;

      const detected = detectImageSignature(buffer.subarray(0, bytesRead));
      if (!detected || !ALLOWED_MIME_TYPES.includes(detected)) {
        throw Object.assign(
          new Error(
            `File signature validation failed for '${file.originalname}'. ` +
            `The file content does not match a valid JPEG, PNG, or WebP image signature.`
          ),
          { statusCode: 400 }
        );
      }
      file.mimetype = detected;
    } catch (err) {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch {}
      }
      cleanupUploadedFiles(files);
      throw err;
    }
  }
};

/**
 * Removes uploaded files from disk — called on validation or DB failure.
 * Prevents orphaned files from partial or failed uploads.
 */
export const cleanupUploadedFiles = (files: Express.Multer.File[]): void => {
  if (!Array.isArray(files)) return;
  for (const file of files) {
    try {
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch {
      // Non-fatal cleanup
    }
  }
};

/**
 * Wraps Multer upload with automatic error cleanup and magic bytes validation.
 * Ensures zero orphaned files on any failure during multi-file upload or signature check.
 */
export const evidenceUploadMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  evidenceUpload.array('evidence', MAX_FILES)(req, res, async (err) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (err) {
      cleanupUploadedFiles(files);
      if (err.name === 'MulterError' || !err.statusCode) {
        err.statusCode = 400;
      }
      return next(err);
    }

    try {
      await validateUploadedImageFiles(files);
      next();
    } catch (validationErr) {
      cleanupUploadedFiles(files);
      next(validationErr);
    }
  });
};

/**
 * Returns the absolute path to an evidence file by stored filename.
 * Prevents path traversal by rejecting any filename with directory separators.
 */
export const resolveEvidencePath = (storedFilename: string): string | null => {
  const basename = path.basename(storedFilename);
  if (basename !== storedFilename) return null;
  const fullPath = path.join(UPLOAD_DIR, basename);
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
};

export { UPLOAD_DIR };
