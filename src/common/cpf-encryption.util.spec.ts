/**
 * Guards the properties the rest of the system silently depends on once every
 * cpf column is encrypted at rest (see cpf-encryption.util.ts):
 *
 *  - determinism, because CPF lookups are exact-match WHERE clauses against
 *    the stored ciphertext (auth's duplicate check, patient/doctor search)
 *    and because the `cpfUnique` DB constraint compares stored bytes;
 *  - canonicalization, because not every write path normalizes the mask
 *    before saving — without it, '390.533.447-05' and '39053344705' become
 *    two different patients with the same CPF;
 *  - idempotency, because the migration re-encrypts rows in place and may be
 *    re-run by a retried deploy.
 *
 * A regression in any of these is silent at runtime (no error, just records
 * that stop being findable), which is exactly why they're pinned here.
 */

const VALID_CPF = '39053344705';
const VALID_CPF_MASKED = '390.533.447-05';
const OTHER_CPF = '12345678909';

// Set before importing: the module reads process.env lazily per call, but
// keeping this at the top makes the dependency explicit.
const TEST_KEY = 'a'.repeat(64);

describe('cpf-encryption.util', () => {
  const originalKey = process.env.CPF_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CPF_ENCRYPTION_KEY = TEST_KEY;
    jest.resetModules();
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.CPF_ENCRYPTION_KEY;
    else process.env.CPF_ENCRYPTION_KEY = originalKey;
  });

  // Required because each test tweaks process.env and resetModules() drops the
  // cached module — a top-level import would capture a stale key.
  function load() {
    return require('./cpf-encryption.util') as typeof import('./cpf-encryption.util');
  }

  describe('encryptCpf / decryptCpf', () => {
    it('round-trips a CPF back to its digits', () => {
      const { encryptCpf, decryptCpf } = load();
      expect(decryptCpf(encryptCpf(VALID_CPF))).toBe(VALID_CPF);
    });

    it('does not store the CPF in readable form', () => {
      const { encryptCpf } = load();
      const stored = encryptCpf(VALID_CPF);
      expect(stored).not.toContain(VALID_CPF);
      expect(stored.startsWith('enc:')).toBe(true);
    });

    it('is deterministic — the same CPF always yields the same stored value', () => {
      const { encryptCpf } = load();
      expect(encryptCpf(VALID_CPF)).toBe(encryptCpf(VALID_CPF));
    });

    it('yields different values for different CPFs', () => {
      const { encryptCpf } = load();
      expect(encryptCpf(VALID_CPF)).not.toBe(encryptCpf(OTHER_CPF));
    });

    it('treats a masked CPF as the same value as its unmasked form', () => {
      // The property the `cpfUnique` constraint and every exact-match lookup
      // rely on: write paths that forget to normalize must not create a
      // second, unfindable record for the same person.
      const { encryptCpf, decryptCpf } = load();
      expect(encryptCpf(VALID_CPF_MASKED)).toBe(encryptCpf(VALID_CPF));
      expect(decryptCpf(encryptCpf(VALID_CPF_MASKED))).toBe(VALID_CPF);
    });

    it('fits within the 64-char column width', () => {
      const { encryptCpf } = load();
      expect(encryptCpf(VALID_CPF).length).toBeLessThanOrEqual(64);
    });

    it('is idempotent — re-encrypting an encrypted value is a no-op', () => {
      const { encryptCpf } = load();
      const once = encryptCpf(VALID_CPF);
      expect(encryptCpf(once)).toBe(once);
    });

    it('reads legacy plaintext through unchanged', () => {
      // The migration encrypts in place; a row it hasn't reached yet (or a
      // rolled-back deploy) must still be readable rather than throwing.
      const { decryptCpf } = load();
      expect(decryptCpf(VALID_CPF)).toBe(VALID_CPF);
    });

    it('passes empty/null values straight through', () => {
      const { encryptCpf, decryptCpf } = load();
      expect(encryptCpf('')).toBe('');
      expect(decryptCpf('')).toBe('');
      expect(encryptCpf(null as unknown as string)).toBeNull();
      expect(decryptCpf(null as unknown as string)).toBeNull();
    });

    it('a value encrypted under one key is not readable under another', () => {
      const { encryptCpf } = load();
      const stored = encryptCpf(VALID_CPF);

      process.env.CPF_ENCRYPTION_KEY = 'b'.repeat(64);
      jest.resetModules();
      const { decryptCpf } = load();

      // Wrong key: either the padding check fails (throw) or it decodes to
      // garbage. Both are acceptable; silently returning the real CPF is not.
      let decrypted: string | null = null;
      try {
        decrypted = decryptCpf(stored);
      } catch {
        decrypted = null;
      }
      expect(decrypted).not.toBe(VALID_CPF);
    });
  });

  describe('cpfColumnTransformer', () => {
    it('encrypts on write and decrypts on read', () => {
      const { cpfColumnTransformer, isEncryptedCpf } = load();
      const stored = cpfColumnTransformer.to(VALID_CPF) as string;
      expect(isEncryptedCpf(stored)).toBe(true);
      expect(cpfColumnTransformer.from(stored)).toBe(VALID_CPF);
    });

    it('leaves null untouched in both directions', () => {
      const { cpfColumnTransformer } = load();
      expect(cpfColumnTransformer.to(null)).toBeNull();
      expect(cpfColumnTransformer.from(null)).toBeNull();
    });
  });

  describe('assertCpfEncryptionKeyConfigured', () => {
    it('throws when the key is missing', () => {
      delete process.env.CPF_ENCRYPTION_KEY;
      jest.resetModules();
      const { assertCpfEncryptionKeyConfigured } = load();
      expect(() => assertCpfEncryptionKeyConfigured()).toThrow(
        /CPF_ENCRYPTION_KEY is not configured/,
      );
    });

    it('throws on a non-hex or wrong-length key', () => {
      // Buffer.from('zz...', 'hex') returns an empty buffer instead of
      // throwing, so a placeholder key must be rejected explicitly.
      for (const bad of ['tooshort', 'z'.repeat(64), 'a'.repeat(63)]) {
        process.env.CPF_ENCRYPTION_KEY = bad;
        jest.resetModules();
        const { assertCpfEncryptionKeyConfigured } = load();
        expect(() => assertCpfEncryptionKeyConfigured()).toThrow(/64-character hex/);
      }
    });

    it('accepts a valid 64-char hex key', () => {
      const { assertCpfEncryptionKeyConfigured } = load();
      expect(() => assertCpfEncryptionKeyConfigured()).not.toThrow();
    });
  });
});
