import { createCipheriv, createDecipheriv, createHmac } from 'crypto';
import type { ValueTransformer } from 'typeorm';

const ALGORITHM = 'aes-256-cbc';
const PREFIX = 'enc:';

/**
 * Deterministic AES-256-CBC: the IV is derived from HMAC-SHA256(key, plaintext)
 * instead of being random, so encrypting the same CPF twice always produces
 * the same stored value. This is a deliberate trade-off (chosen over fully
 * randomized AES-GCM) because CPF needs to keep working with:
 *  - the DB-level uniqueness constraint on patients.cpf (see migration
 *    1828000000000-AddUniquePatientCpf.ts, which mirrors this column verbatim
 *    into a generated column — it has no idea the value is encrypted, so
 *    determinism is what makes "same CPF -> same stored bytes" still hold),
 *  - exact-match lookups (login/duplicate-check flows across
 *    patients/auth/clinic-admin).
 * It deliberately gives up: hiding that two rows share the same CPF (an
 * attacker with DB access can tell two ciphertexts are equal, just not what
 * the CPF is) — an accepted trade-off for this specific field, not a pattern
 * to copy for values that don't need equality/uniqueness at the DB level.
 *
 * The IV is stored alongside the ciphertext (prefix of the decoded bytes) so
 * decryption never needs to re-derive anything from a plaintext it doesn't
 * have yet.
 */
function getKey(): Buffer {
  const keyHex = process.env.CPF_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'CPF_ENCRYPTION_KEY is not configured. Generate one with `openssl rand -hex 32` and set it before any code path touches a cpf column.',
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    // Checked as a string before Buffer.from: `Buffer.from('zz', 'hex')`
    // silently returns an empty buffer instead of throwing, so a typo'd or
    // placeholder key would otherwise slip through to a confusing failure.
    throw new Error('CPF_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Fail-fast check for app startup (called from main.ts bootstrap).
 *
 * Without it the key is only validated the first time some request touches a
 * cpf column — so a deploy with a missing/typo'd key would come up "healthy"
 * and then fail at signup/login/patient-search instead of refusing to boot.
 * Worse, the same deploy would happily keep writing other tables, leaving a
 * half-usable production. Crashing at boot is the recoverable failure.
 */
export function assertCpfEncryptionKeyConfigured(): void {
  getKey();
}

function deriveIv(key: Buffer, plaintext: string): Buffer {
  return createHmac('sha256', key).update(plaintext).digest().subarray(0, 16);
}

/** True for a value already in this module's stored format — lets callers
 * (migrations, this transformer) tell already-encrypted rows apart from
 * legacy plaintext without needing a separate "migrated" flag column. */
export function isEncryptedCpf(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Canonical form used as the encryption input: digits only.
 *
 * This is load-bearing, not cosmetic. Deterministic encryption means equality
 * only survives if the *plaintext* is byte-identical, so '390.533.447-05' and
 * '39053344705' would otherwise encrypt to two different values — silently
 * breaking both the CPF lookup (auth signup conflict check, patient/doctor
 * search) and the `cpfUnique` DB constraint for anything written masked. Not
 * every write path normalizes today (clinics.service / clinic-admin's
 * createShadowDoctor pass `dto.cpf` straight through, and the synthetic
 * shadow-secretary placeholder is masked), so canonicalizing at this single
 * chokepoint is what makes "same CPF -> same stored bytes" actually true.
 *
 * Falls back to the original string when it holds no digits at all, so a
 * non-CPF legacy value is never silently replaced with an empty one.
 */
function canonicalizeCpf(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits || value;
}

export function encryptCpf(plainCpf: string): string {
  if (!plainCpf) return plainCpf;
  if (isEncryptedCpf(plainCpf)) return plainCpf; // idempotent — safe to call twice
  const canonical = canonicalizeCpf(plainCpf);
  const key = getKey();
  const iv = deriveIv(key, canonical);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(canonical, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, ciphertext]).toString('base64');
}

export function decryptCpf(storedValue: string): string {
  if (!storedValue) return storedValue;
  if (!isEncryptedCpf(storedValue)) return storedValue; // legacy plaintext, read-through
  const key = getKey();
  const raw = Buffer.from(storedValue.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, 16);
  const ciphertext = raw.subarray(16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Applied via `@Column({ transformer: cpfColumnTransformer })` on every cpf
 * column (Patient, Doctor, SecretaryProfile, ClinicAdminProfile). Encrypts on
 * write, decrypts on read — transparent to every existing `.cpf` access in
 * application code (services/controllers always see plaintext). */
export const cpfColumnTransformer: ValueTransformer = {
  to: (value: string | null) => (value ? encryptCpf(value) : value),
  from: (value: string | null) => (value ? decryptCpf(value) : value),
};
