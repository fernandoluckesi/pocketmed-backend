import { BadRequestException } from '@nestjs/common';
import {
  createFileTypeValidationPipe,
  DOCUMENT_MIME_TYPES,
  PROFILE_IMAGE_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE,
} from './upload-validation';

/**
 * Covers security item #16 (upload type/size validation).
 *
 * The whole point of this control is that it inspects the file's actual
 * bytes rather than the client-declared `mimetype` — so the fixtures below
 * are real magic-number headers, and the key cases deliberately LIE in the
 * declared mimetype to prove the bytes win.
 *
 * The "accepts legitimate files" cases below carry weight beyond the usual:
 * this control's dangerous failure mode is rejecting *everything*, which
 * breaks every upload in the product while still looking "secure". That is
 * exactly what happened with the first implementation of this fix, built on
 * NestJS's `FileTypeValidator` — it reaches the ESM-only `file-type`
 * package through `eval('import("file-type")')` inside a `catch` that
 * returns `false`, so when the import failed the rejection was silent and
 * total. Hence the local, directly testable detector in file-signature.ts.
 */

/** Real file signatures (magic numbers) for each accepted format. */
const MAGIC = {
  pdf: Buffer.from('255044462d312e340a', 'hex'), // %PDF-1.4\n
  png: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  jpeg: Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex'),
  gif: Buffer.from('474946383961010001000000', 'hex'), // GIF89a
  webp: Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from('24000000', 'hex'),
    Buffer.from('WEBPVP8 '),
    Buffer.alloc(16),
  ]),
  // Windows PE executable — the ".exe disguised as a PDF" from the audit.
  exe: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64), Buffer.from('PE\0\0')]),
  zip: Buffer.from('504b03040a00000000', 'hex'),
  elf: Buffer.from('7f454c4602010100000000000000000002003e00', 'hex'),
};

function fileOf(buffer: Buffer, mimetype: string, originalname = 'upload'): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    stream: null as never,
    destination: '',
    filename: originalname,
    path: '',
  };
}

describe('upload validation (security item #16)', () => {
  describe('accepts legitimate files', () => {
    it.each([
      ['PDF', MAGIC.pdf, 'application/pdf'],
      ['PNG', MAGIC.png, 'image/png'],
      ['JPEG', MAGIC.jpeg, 'image/jpeg'],
      ['GIF', MAGIC.gif, 'image/gif'],
      ['WebP', MAGIC.webp, 'image/webp'],
    ])('accepts a real %s in a document upload', async (_label, buffer, mimetype) => {
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      });
      await expect(pipe.transform(fileOf(buffer, mimetype))).resolves.toBeDefined();
    });

    it('accepts an image in a profile-photo upload', async () => {
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES,
        fileIsRequired: false,
      });
      await expect(pipe.transform(fileOf(MAGIC.png, 'image/png'))).resolves.toBeDefined();
    });
  });

  describe('rejects by actual content, not the declared mimetype', () => {
    it('rejects a Windows executable claiming to be a PDF', async () => {
      // The exact attack named in the audit: a renamed .exe passing as a
      // document. The declared mimetype is a valid, allowed one — only the
      // magic-number check can catch this.
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      });
      await expect(
        pipe.transform(fileOf(MAGIC.exe, 'application/pdf', 'laudo.pdf')),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a Linux ELF binary claiming to be a PNG', async () => {
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      });
      await expect(pipe.transform(fileOf(MAGIC.elf, 'image/png', 'foto.png'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a ZIP archive claiming to be a PDF', async () => {
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      });
      await expect(pipe.transform(fileOf(MAGIC.zip, 'application/pdf'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a PDF in a profile-photo upload', async () => {
      // Profile photos are rendered in an <img>; a PDF there is both useless
      // and a wider attack surface than an image.
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES,
        fileIsRequired: false,
      });
      await expect(pipe.transform(fileOf(MAGIC.pdf, 'application/pdf'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an SVG, whose content cannot be vouched for', async () => {
      // SVG is XML and can carry scripts. It's absent from the allow-list,
      // and it has no binary signature, so it must not slip through.
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES,
        fileIsRequired: false,
      });
      await expect(pipe.transform(fileOf(svg, 'image/svg+xml'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unrecognizable blob', async () => {
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      });
      await expect(
        pipe.transform(fileOf(Buffer.from('just plain text'), 'application/pdf')),
      ).rejects.toThrow(BadRequestException);
    });

    it('surfaces a helpful message listing the accepted formats', async () => {
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      });
      await expect(pipe.transform(fileOf(MAGIC.exe, 'application/pdf'))).rejects.toThrow(
        /Tipo de arquivo não permitido/,
      );
    });
  });

  describe('required vs optional uploads', () => {
    it('rejects a missing file when the upload is required', async () => {
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      });
      await expect(pipe.transform(undefined as never)).rejects.toThrow(BadRequestException);
    });

    it('allows a missing file when the upload is optional', async () => {
      // Regression guard for the signup/profile flows: a patient can
      // register without a photo, so an absent file must pass through
      // untouched rather than 400.
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES,
        fileIsRequired: false,
      });
      await expect(pipe.transform(undefined as never)).resolves.toBeUndefined();
    });
  });

  describe('multi-file uploads', () => {
    it('accepts an array where every file is valid', async () => {
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      });
      const files = [fileOf(MAGIC.pdf, 'application/pdf'), fileOf(MAGIC.png, 'image/png')];
      await expect(pipe.transform(files as never)).resolves.toHaveLength(2);
    });

    it('rejects the whole batch if any single file is invalid', async () => {
      // Exam results accept up to 10 files; one disguised executable among
      // valid PDFs must fail the request, not be quietly skipped.
      const pipe = createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      });
      const files = [
        fileOf(MAGIC.pdf, 'application/pdf'),
        fileOf(MAGIC.exe, 'application/pdf', 'resultado.pdf'),
      ];
      await expect(pipe.transform(files as never)).rejects.toThrow(BadRequestException);
    });
  });

  describe('allow-lists', () => {
    it('keeps PDF out of the profile-image list', () => {
      expect(PROFILE_IMAGE_MIME_TYPES).not.toContain('application/pdf');
      expect(DOCUMENT_MIME_TYPES).toContain('application/pdf');
    });

    it('excludes formats that can carry active content', () => {
      for (const list of [DOCUMENT_MIME_TYPES, PROFILE_IMAGE_MIME_TYPES]) {
        expect(list).not.toContain('image/svg+xml');
        expect(list).not.toContain('text/html');
        expect(list).not.toContain('application/zip');
      }
    });

    it('caps uploads at a sane size', () => {
      expect(MAX_UPLOAD_FILE_SIZE).toBe(15 * 1024 * 1024);
    });
  });
});
