import { BadRequestException, FileValidator, ParseFilePipe } from '@nestjs/common';
import { detectMimeFromBuffer } from './file-signature';

/**
 * Shared upload limits for item #16 (file type/size validation). One size
 * for everything — already the established value in 4 controllers before
 * this file existed; not introducing a smaller limit for profile photos,
 * which could reject legitimate high-resolution phone camera uploads.
 */
export const MAX_UPLOAD_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/webp',
];

export const PROFILE_IMAGE_MIME_TYPES = DOCUMENT_MIME_TYPES.filter((t) => t !== 'application/pdf');

/**
 * Validates a file by its magic bytes against an allow-list.
 *
 * Replaces NestJS's built-in `FileTypeValidator`, which resolves the
 * ESM-only `file-type` package via `eval('import("file-type")')` inside a
 * `catch` that returns `false`. That silently rejects every upload whenever
 * the import can't be resolved (it fails outright under Jest's CommonJS
 * transform), i.e. a security control with a total, invisible failure mode
 * and no way to test it. `detectMimeFromBuffer` is plain CommonJS and
 * directly verifiable — see file-signature.ts.
 */
class MagicByteFileValidator extends FileValidator<{ allowedMimeTypes: string[] }> {
  constructor(allowedMimeTypes: string[]) {
    super({ allowedMimeTypes });
  }

  isValid(file?: Express.Multer.File): boolean {
    // No buffer means multer wasn't configured with memoryStorage for this
    // route. Rejecting is the safe default: silently passing would turn the
    // whole check into a no-op the moment a route changes storage engine.
    if (!file?.buffer) return false;

    const detected = detectMimeFromBuffer(file.buffer);
    if (!detected) return false;
    return this.validationOptions.allowedMimeTypes.includes(detected);
  }

  buildErrorMessage(): string {
    return (
      `Tipo de arquivo não permitido. Formatos aceitos: ` +
      `${this.validationOptions.allowedMimeTypes.join(', ')}.`
    );
  }
}

/**
 * Builds the pipe applied to every `@UploadedFile()`/`@UploadedFiles()` in
 * the app. Checks the file's actual content rather than the client-declared
 * `mimetype`, so a renamed `.exe` claiming to be a PDF is rejected.
 *
 * `ParseFilePipe` handles both the single-file and array cases, and — with
 * `fileIsRequired: false` — lets an absent optional upload through
 * untouched (patient signup without a photo, for instance).
 */
export function createFileTypeValidationPipe(options: {
  allowedMimeTypes: string[];
  fileIsRequired: boolean;
}): ParseFilePipe {
  return new ParseFilePipe({
    fileIsRequired: options.fileIsRequired,
    validators: [new MagicByteFileValidator(options.allowedMimeTypes)],
    exceptionFactory: (error: string) => new BadRequestException(error),
  });
}
