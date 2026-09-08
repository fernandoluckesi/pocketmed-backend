import { isValidCpf, normalizeCpf } from './cpf.util';

describe('cpf.util', () => {
  // 390.533.447-05 and 111.444.777-35 are well-known structurally valid CPFs
  // (correct check digits). They are not real people's documents.
  const VALID_UNMASKED = '39053344705';
  const VALID_MASKED = '390.533.447-05';

  describe('normalizeCpf', () => {
    it('strips mask and non-digits', () => {
      expect(normalizeCpf('390.533.447-05')).toBe('39053344705');
      expect(normalizeCpf(' 390 533 447 05 ')).toBe('39053344705');
    });

    it('returns empty string for null/undefined/empty', () => {
      expect(normalizeCpf(null)).toBe('');
      expect(normalizeCpf(undefined)).toBe('');
      expect(normalizeCpf('')).toBe('');
    });
  });

  describe('isValidCpf', () => {
    it('accepts a valid CPF without mask', () => {
      expect(isValidCpf(VALID_UNMASKED)).toBe(true);
      expect(isValidCpf('11144477735')).toBe(true);
    });

    it('accepts a valid CPF with mask', () => {
      expect(isValidCpf(VALID_MASKED)).toBe(true);
    });

    it('rejects a CPF with wrong check digits', () => {
      expect(isValidCpf('39053344700')).toBe(false);
      expect(isValidCpf('12345678900')).toBe(false);
    });

    it('rejects wrong length', () => {
      expect(isValidCpf('123')).toBe(false);
      expect(isValidCpf('390533447050')).toBe(false);
    });

    it('rejects repeated-digit sequences', () => {
      expect(isValidCpf('00000000000')).toBe(false);
      expect(isValidCpf('11111111111')).toBe(false);
      expect(isValidCpf('99999999999')).toBe(false);
    });

    it('rejects empty/null/undefined', () => {
      expect(isValidCpf('')).toBe(false);
      expect(isValidCpf(null)).toBe(false);
      expect(isValidCpf(undefined)).toBe(false);
    });
  });
});
