import { detectMimeFromBuffer } from './file-signature';

/**
 * Unit coverage for the magic-byte detector behind upload validation
 * (security item #16).
 *
 * Kept separate from upload-validation.spec.ts because the properties being
 * pinned are different: this file is about correctly identifying bytes,
 * including the real-world variants the platform actually receives (iPhone
 * HEIC, Exif JPEG from a camera, scanner TIFF in both byte orders), and
 * about refusing to guess when it can't be sure.
 */

function buf(hex: string): Buffer {
  return Buffer.from(hex.replace(/\s/g, ''), 'hex');
}

/** ISOBMFF header: 4-byte box size, 'ftyp', then the 4-char brand. */
function isobmff(brand: string): Buffer {
  return Buffer.concat([buf('00000018'), Buffer.from('ftyp'), Buffer.from(brand), Buffer.alloc(8)]);
}

describe('detectMimeFromBuffer', () => {
  describe('identifies accepted formats', () => {
    it('detects PDF', () => {
      expect(detectMimeFromBuffer(Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3'))).toBe(
        'application/pdf',
      );
    });

    it('detects PNG', () => {
      expect(detectMimeFromBuffer(buf('89504e470d0a1a0a 0000000d49484452'))).toBe('image/png');
    });

    it.each([
      ['JFIF', 'ffd8ffe0 00104a46 49460001'],
      ['Exif (camera/phone photo)', 'ffd8ffe1 00184578 69660000'],
      ['raw/other marker', 'ffd8ffdb 00430005 03040403'],
    ])('detects JPEG variant: %s', (_label, hex) => {
      // All three reach the backend in practice; the shared prefix is
      // FF D8 FF, with the 4th byte identifying the segment.
      expect(detectMimeFromBuffer(buf(hex))).toBe('image/jpeg');
    });

    it.each([
      ['GIF87a', '474946383761 010001000000'],
      ['GIF89a', '474946383961 010001000000'],
    ])('detects %s', (_label, hex) => {
      expect(detectMimeFromBuffer(buf(hex))).toBe('image/gif');
    });

    it.each([
      ['little-endian (II*\\0)', '49492a00 08000000'],
      ['big-endian (MM\\0*)', '4d4d002a 00000008'],
    ])('detects TIFF %s', (_label, hex) => {
      // Scanners produce both byte orders; only handling one would reject
      // legitimate scanned exam results.
      expect(detectMimeFromBuffer(buf(hex))).toBe('image/tiff');
    });

    it('detects WebP', () => {
      const webp = Buffer.concat([
        Buffer.from('RIFF'),
        buf('24000000'),
        Buffer.from('WEBPVP8 '),
        Buffer.alloc(8),
      ]);
      expect(detectMimeFromBuffer(webp)).toBe('image/webp');
    });

    it.each([
      ['heic', 'image/heic'],
      ['heix', 'image/heic'],
      ['mif1', 'image/heif'],
      ['msf1', 'image/heif'],
    ])('detects HEIF brand %s', (brand, expected) => {
      // iPhones upload HEIC by default, so this path is hit constantly.
      expect(detectMimeFromBuffer(isobmff(brand))).toBe(expected);
    });
  });

  describe('refuses content it cannot vouch for', () => {
    it.each([
      ['Windows PE executable', '4d5a9000 03000000 04000000'],
      ['Linux ELF binary', '7f454c46 02010100 00000000'],
      ['ZIP archive', '504b0304 0a000000 0000'],
      ['RAR archive', '52617221 1a070000'],
      ['Mach-O binary', 'cffaedfe 07000001 03000000'],
      ['shell script', Buffer.from('#!/bin/sh\necho hi').toString('hex')],
    ])('rejects %s', (_label, hex) => {
      expect(detectMimeFromBuffer(buf(hex))).toBeNull();
    });

    it('rejects SVG, which has no binary signature', () => {
      // SVG is XML and can embed <script>. "Can't prove what this is" must
      // mean rejection — never a pass.
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
      expect(detectMimeFromBuffer(svg)).toBeNull();
    });

    it('rejects HTML', () => {
      expect(detectMimeFromBuffer(Buffer.from('<!DOCTYPE html><html></html>'))).toBeNull();
    });

    it('rejects an mp4 video wearing an ISOBMFF header', () => {
      // mp4 shares the `ftyp` box with HEIC. Only still-image brands are
      // mapped, so video brands must not pass as images.
      for (const brand of ['mp41', 'mp42', 'isom', 'avc1', 'qt  ']) {
        expect(detectMimeFromBuffer(isobmff(brand))).toBeNull();
      }
    });

    it('rejects a truncated GIF-like header', () => {
      // 'GIF8' alone isn't enough; the version must be 7a or 9a.
      expect(detectMimeFromBuffer(buf('474946380000 000000000000'))).toBeNull();
    });

    it('rejects RIFF that is not WebP (e.g. a WAV file)', () => {
      const wav = Buffer.concat([
        Buffer.from('RIFF'),
        buf('24000000'),
        Buffer.from('WAVEfmt '),
        Buffer.alloc(8),
      ]);
      expect(detectMimeFromBuffer(wav)).toBeNull();
    });

    it('rejects a valid signature that appears at the wrong offset', () => {
      // A PDF header buried after arbitrary bytes is not a PDF; the check is
      // anchored at offset 0 (except `ftyp`, which the spec puts at 4).
      const shifted = Buffer.concat([Buffer.alloc(8), Buffer.from('%PDF-1.4')]);
      expect(detectMimeFromBuffer(shifted)).toBeNull();
    });
  });

  describe('handles degenerate input without throwing', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty buffer', Buffer.alloc(0)],
      ['1 byte', Buffer.from([0x25])],
      ['3 bytes, below the minimum', Buffer.from([0x25, 0x50, 0x44])],
    ])('returns null for %s', (_label, input) => {
      expect(detectMimeFromBuffer(input as Buffer | undefined | null)).toBeNull();
    });

    it('identifies a file that is exactly its signature length', () => {
      // Guards the MIN_HEADER_BYTES boundary: gating on the longest
      // signature (12, for ISOBMFF) would wrongly reject this 4-byte PDF
      // header — which is what the first version of this file did.
      expect(detectMimeFromBuffer(Buffer.from('%PDF'))).toBe('application/pdf');
    });
  });
});
