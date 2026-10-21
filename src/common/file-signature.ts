/**
 * Magic-number (file signature) detection for the formats this platform
 * accepts as uploads.
 *
 * Why not the `file-type` package: it is ESM-only from v17 onward, and
 * NestJS's built-in `FileTypeValidator` reaches it through
 * `eval('import("file-type")')` wrapped in a `catch` that returns `false`.
 * That works in the compiled CommonJS runtime but fails under Jest's
 * CommonJS transform ("A dynamic import callback was invoked without
 * --experimental-vm-modules"), and because the failure is swallowed the
 * validator silently rejects *every* upload. A security control whose
 * failure mode is both total and invisible — and which can't be exercised
 * in tests — isn't one worth depending on.
 *
 * So detection is done here instead: an explicit table covering exactly the
 * formats in the allow-lists. This is deliberately narrower than a general
 * type sniffer. For an allow-list check, "I can positively identify these N
 * formats and reject everything else" is the property we want; being able
 * to name 200 other formats adds nothing.
 *
 * Signature references are the formats' own published specs (PDF 32000,
 * ISO/IEC 10918 for JPEG, RFC 2083 for PNG, ISO/IEC 14496-12 for the
 * ISOBMFF `ftyp` family used by HEIC/HEIF).
 */

/** MIME types this module can positively identify. */
export type DetectedMime =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/tiff'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

/**
 * Shortest signature this module can match (`%PDF`, `GIF8`, the TIFF byte
 * orders). Deliberately the *shortest* and not the longest: every check
 * below bounds-checks its own read, so gating on the longest (12, for the
 * ISOBMFF brand) would reject a legitimately short file whose format only
 * needs 4 bytes to identify.
 */
const MIN_HEADER_BYTES = 4;

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function asciiAt(buffer: Buffer, offset: number, length: number): string {
  if (buffer.length < offset + length) return '';
  return buffer.subarray(offset, offset + length).toString('latin1');
}

/**
 * HEIC/HEIF and other ISOBMFF files share the `ftyp` box at offset 4; the
 * concrete format is the 4-char brand that follows. Only still-image brands
 * are mapped — notably NOT the video ones (`mp41`, `isom`, `avc1`…), so an
 * mp4 renamed to .heic doesn't pass as an image.
 */
const HEIF_BRANDS: Record<string, DetectedMime> = {
  heic: 'image/heic',
  heix: 'image/heic',
  hevc: 'image/heic',
  hevx: 'image/heic',
  heim: 'image/heif',
  heis: 'image/heif',
  hevm: 'image/heif',
  hevs: 'image/heif',
  mif1: 'image/heif',
  msf1: 'image/heif',
};

/**
 * Returns the MIME type the bytes actually represent, or null when the
 * content isn't one of the accepted formats.
 *
 * Null is the safe answer for everything unrecognized — including formats
 * that have no binary signature at all, like SVG. That is intentional: SVG
 * is XML that can carry scripts, so "can't prove what this is" must mean
 * rejection, never a pass.
 */
export function detectMimeFromBuffer(buffer: Buffer | undefined | null): DetectedMime | null {
  if (!buffer || buffer.length < MIN_HEADER_BYTES) return null;

  // %PDF
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';

  // JPEG SOI + marker. Covers JFIF/Exif/raw variants alike.
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';

  // PNG 8-byte signature.
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';

  // GIF87a / GIF89a
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) {
    const version = asciiAt(buffer, 4, 2);
    if (version === '7a' || version === '9a') return 'image/gif';
    return null;
  }

  // TIFF, little-endian (II*\0) and big-endian (MM\0*).
  if (
    startsWith(buffer, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return 'image/tiff';
  }

  // WebP: 'RIFF' .... 'WEBP' — the size field in between is skipped.
  if (asciiAt(buffer, 0, 4) === 'RIFF' && asciiAt(buffer, 8, 4) === 'WEBP') {
    return 'image/webp';
  }

  // ISOBMFF: 'ftyp' at offset 4, brand at offset 8.
  if (asciiAt(buffer, 4, 4) === 'ftyp') {
    const brand = asciiAt(buffer, 8, 4);
    return HEIF_BRANDS[brand] ?? null;
  }

  return null;
}
