import { ValidationPipe } from '@nestjs/common';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { CURRENT_TERMS_VERSION } from '../common/legal-terms';

/**
 * Covers the Terms/Privacy acceptance tracking (item 5 of the legal audit).
 *
 * Before this, acceptance existed only as a required checkbox in the web
 * form and nothing was persisted. In a dispute, "the checkbox was mandatory"
 * is far weaker evidence than a timestamped record naming the document
 * version — and LGPD art. 11 requires consent for health data to be
 * specific and demonstrable.
 *
 * The case worth protecting here is the multipart one: when signup includes
 * a profile photo the payload is sent as `multipart/form-data`, where every
 * value arrives as a string. Without an explicit transform, `acceptedTerms`
 * would arrive as `"true"`, fail `@IsBoolean()` and return 400 — breaking
 * signup *only* for users who upload a photo. That is exactly the kind of
 * bug that reaches production unnoticed.
 */

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const meta = (metatype: unknown) => ({ type: 'body', metatype, data: undefined }) as never;

const patientBase = {
  name: 'Fernando Luckesi',
  username: 'fernando',
  email: 'f@example.com',
  gender: 'Masculino',
  password: 'Abcdef1!',
  phone: '11999990000',
  birthDate: '1990-01-01',
};

const doctorBase = {
  name: 'Dr. Fernando',
  email: 'dr@example.com',
  password: 'Abcdef1!',
  gender: 'Masculino',
  specialty: 'Cardiologia',
  cpf: '39053344705',
  phone: '11999990000',
  birthDate: '1990-01-01',
  crmNumber: '123456',
  crmUf: 'SP',
};

describe('Terms acceptance tracking (audit item 5)', () => {
  describe.each([
    ['RegisterPatientDto', RegisterPatientDto, patientBase],
    ['RegisterDoctorDto', RegisterDoctorDto, doctorBase],
  ])('%s', (_label, dto, base) => {
    it('accepts a real boolean (JSON payload)', async () => {
      const result = (await pipe.transform({ ...base, acceptedTerms: true }, meta(dto))) as {
        acceptedTerms?: boolean;
      };

      expect(result.acceptedTerms).toBe(true);
    });

    it('coerces the string "true" (multipart payload, signup WITH a photo)', async () => {
      // The regression this guards: multipart turns every field into a
      // string, so a bare @IsBoolean() would 400 here.
      const result = (await pipe.transform({ ...base, acceptedTerms: 'true' }, meta(dto))) as {
        acceptedTerms?: boolean;
      };

      expect(result.acceptedTerms).toBe(true);
      expect(typeof result.acceptedTerms).toBe('boolean');
    });

    it('coerces the string "false"', async () => {
      const result = (await pipe.transform({ ...base, acceptedTerms: 'false' }, meta(dto))) as {
        acceptedTerms?: boolean;
      };

      expect(result.acceptedTerms).toBe(false);
    });

    it('stays optional, so older clients keep working', async () => {
      // Absent → nothing recorded → the column stays NULL, meaning
      // "accepted before we started tracking" rather than a fabricated date.
      const result = (await pipe.transform({ ...base }, meta(dto))) as {
        acceptedTerms?: boolean;
      };

      expect(result.acceptedTerms).toBeUndefined();
    });

    it('rejects a value that is neither boolean nor a boolean-like string', async () => {
      await expect(
        pipe.transform({ ...base, acceptedTerms: 'maybe' }, meta(dto)),
      ).rejects.toThrow();
    });
  });

  describe('version constant', () => {
    it('is set and matches the YYYY-MM shape', () => {
      // Stored with the timestamp so we can later answer "which text did
      // this user agree to?" — the documents live in the frontend bundle,
      // so a date-based version is what identifies them.
      expect(CURRENT_TERMS_VERSION).toMatch(/^\d{4}-\d{2}$/);
    });

    it('reflects the October 2026 revision', () => {
      // Bumped when the refund policy, subprocessors, international
      // transfer, minors' data, clinical-content liability and the CFM
      // retention sections were added.
      expect(CURRENT_TERMS_VERSION).toBe('2026-10');
    });
  });
});
