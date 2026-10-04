import { canonicalizeCrm, formatCrm, isValidUf, parseCrm, resolveCrmInput } from './crm.util';

/**
 * These cases are drawn from the shapes actually present in the database
 * (web signup, mobile, clinic seeds, synthetic secretary CRMs) — the whole
 * point of the utility is that every one of them resolves to the same
 * canonical pair, so uniqueness and search stop depending on which client
 * created the row.
 */
describe('crm.util', () => {
  describe('parseCrm', () => {
    it('parses the web signup shape "123456/SP"', () => {
      expect(parseCrm('123456/SP')).toEqual({ number: '123456', uf: 'SP' });
    });

    it('parses the mobile shape "SP-123456"', () => {
      expect(parseCrm('SP-123456')).toEqual({ number: '123456', uf: 'SP' });
    });

    it('parses the clinic seed shape "CRM-SP-00001", preserving leading zeros', () => {
      expect(parseCrm('CRM-SP-00001')).toEqual({ number: '00001', uf: 'SP' });
    });

    it('parses the free-text certificate shape "CRM/SP 123456"', () => {
      expect(parseCrm('CRM/SP 123456')).toEqual({ number: '123456', uf: 'SP' });
    });

    it('tolerates spaces around the separator', () => {
      expect(parseCrm(' 123456 / sp ')).toEqual({ number: '123456', uf: 'SP' });
    });

    it('lowercases input are normalized to uppercase UF', () => {
      expect(parseCrm('sp-98765')).toEqual({ number: '98765', uf: 'SP' });
    });

    it('returns an empty UF when the 2-letter run is not a real UF', () => {
      // "XX" is not a Brazilian UF — better to report no UF than a wrong one.
      expect(parseCrm('123456/XX')).toEqual({ number: '123456', uf: '' });
    });

    it('handles a bare number with no UF', () => {
      expect(parseCrm('123456')).toEqual({ number: '123456', uf: '' });
    });

    it('handles synthetic secretary CRMs that never had a UF', () => {
      expect(parseCrm('SEC00001')).toEqual({ number: '00001', uf: '' });
    });

    it('returns empties for null/undefined/blank', () => {
      expect(parseCrm(null)).toEqual({ number: '', uf: '' });
      expect(parseCrm(undefined)).toEqual({ number: '', uf: '' });
      expect(parseCrm('   ')).toEqual({ number: '', uf: '' });
    });

    it('picks the longest digit run as the registration number', () => {
      expect(parseCrm('CRM 12 SP 445566')).toEqual({ number: '445566', uf: 'SP' });
    });
  });

  describe('formatCrm', () => {
    it('builds the canonical "number/UF" form', () => {
      expect(formatCrm('123456', 'SP')).toBe('123456/SP');
    });

    it('uppercases the UF', () => {
      expect(formatCrm('123456', 'sp')).toBe('123456/SP');
    });

    it('omits the UF when absent', () => {
      expect(formatCrm('123456', null)).toBe('123456');
    });

    it('returns empty when there is no number', () => {
      expect(formatCrm('', 'SP')).toBe('');
    });
  });

  describe('canonicalizeCrm', () => {
    it('collapses every legacy shape to one canonical string', () => {
      const canonical = '123456/SP';
      expect(canonicalizeCrm('123456/SP')).toBe(canonical);
      expect(canonicalizeCrm('SP-123456')).toBe(canonical);
      expect(canonicalizeCrm('CRM/SP 123456')).toBe(canonical);
      expect(canonicalizeCrm('crm-sp-123456')).toBe(canonical);
    });

    it('keeps the original value when there is nothing to normalize', () => {
      // Synthetic CRMs have no digits+UF pair; destroying them would break
      // the secretary accounts that rely on them.
      expect(canonicalizeCrm('SEC')).toBe('SEC');
    });
  });

  describe('isValidUf', () => {
    it('accepts every real UF, case-insensitively', () => {
      expect(isValidUf('SP')).toBe(true);
      expect(isValidUf('sp')).toBe(true);
      expect(isValidUf('DF')).toBe(true);
    });

    it('rejects non-UFs and blanks', () => {
      expect(isValidUf('XX')).toBe(false);
      expect(isValidUf('')).toBe(false);
      expect(isValidUf(null)).toBe(false);
    });
  });

  describe('resolveCrmInput', () => {
    it('uses the separate fields when provided', () => {
      expect(resolveCrmInput({ crmNumber: '123456', crmUf: 'SP' })).toEqual({
        crm: '123456/SP',
        crmNumber: '123456',
        crmUf: 'SP',
      });
    });

    it('normalizes a lowercase UF from the separate fields', () => {
      expect(resolveCrmInput({ crmNumber: '123456', crmUf: 'sp' })).toEqual({
        crm: '123456/SP',
        crmNumber: '123456',
        crmUf: 'SP',
      });
    });

    it('falls back to parsing the legacy combined string', () => {
      // This is the path mobile still takes while it ships the old payload.
      expect(resolveCrmInput({ crm: 'SP-123456' })).toEqual({
        crm: '123456/SP',
        crmNumber: '123456',
        crmUf: 'SP',
      });
    });

    it('prefers the separate fields over a conflicting legacy string', () => {
      expect(resolveCrmInput({ crm: 'RJ-999999', crmNumber: '123456', crmUf: 'SP' })).toEqual({
        crm: '123456/SP',
        crmNumber: '123456',
        crmUf: 'SP',
      });
    });

    it('drops an invalid UF instead of persisting it', () => {
      expect(resolveCrmInput({ crmNumber: '123456', crmUf: 'XX' })).toEqual({
        crm: '123456',
        crmNumber: '123456',
        crmUf: null,
      });
    });

    it('keeps a synthetic CRM intact with empty structured fields', () => {
      expect(resolveCrmInput({ crm: 'SEC' })).toEqual({
        crm: 'SEC',
        crmNumber: null,
        crmUf: null,
      });
    });

    it('returns empties for an entirely empty input', () => {
      expect(resolveCrmInput({})).toEqual({
        crm: '',
        crmNumber: null,
        crmUf: null,
      });
    });
  });
});
