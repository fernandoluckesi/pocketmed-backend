import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as fc from 'fast-check';
import { CreateClinicDto } from './create-clinic.dto';

/**
 * Feature: clinic-address-cep
 * Property-based tests for CreateClinicDto address validation
 */

/** Helper: builds a fully valid CreateClinicDto plain object */
function buildValidDto(overrides: Partial<Record<string, any>> = {}): Record<string, any> {
  return {
    // Clinic data
    clinicName: 'Clínica Teste',
    cnpj: '12.345.678/0001-99',
    // Address fields
    cep: '01001000',
    street: 'Praça da Sé',
    number: '100',
    complement: 'Sala 1',
    neighborhood: 'Sé',
    city: 'São Paulo',
    state: 'SP',
    noNumber: false,
    // Doctor admin data
    name: 'Dr. Teste',
    email: 'dr.teste@email.com',
    password: 'Senha@123',
    gender: 'Masculino',
    specialty: 'Cardiologia',
    cpf: '42275937862',
    phone: '(11) 99248-6811',
    birthDate: '2002-06-08',
    crm: '198850/SP',
    ...overrides,
  };
}

function createDto(overrides: Partial<Record<string, any>> = {}): CreateClinicDto {
  return plainToInstance(CreateClinicDto, buildValidDto(overrides));
}

/** Helper: generates a string of digits with exact length */
function digitString(length: number) {
  return fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength: length, maxLength: length })
    .map((digits) => digits.join(''));
}

/** Helper: generates a string of digits with variable length */
function digitStringRange(minLen: number, maxLen: number) {
  return fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength: minLen, maxLength: maxLen })
    .map((digits) => digits.join(''));
}

describe('CreateClinicDto - Property-Based Tests', () => {
  /**
   * Property 3: Conditional number validation based on noNumber flag
   *
   * For any valid CreateClinicDto, if noNumber is true then number may be
   * empty/null/undefined and validation SHALL pass; if noNumber is false or
   * absent then number being empty/null/undefined SHALL cause validation to fail.
   *
   * **Validates: Requirements 2.2, 2.3, 3.3, 3.4**
   */
  describe('Property 3: Conditional number validation based on noNumber flag', () => {
    it('when noNumber is true, empty/null/undefined number passes validation', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('', undefined, null), async (numberValue) => {
          const dto = createDto({
            noNumber: true,
            number: numberValue as any,
          });

          const errors = await validate(dto);

          // There should be no validation error on 'number' field
          const numberErrors = errors.filter((e) => e.property === 'number');
          expect(numberErrors).toHaveLength(0);
        }),
        { numRuns: 100 },
      );
    });

    it('when noNumber is false, empty/null/undefined number fails validation', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('', undefined, null), async (numberValue) => {
          const dto = createDto({
            noNumber: false,
            number: numberValue as any,
          });

          const errors = await validate(dto);

          // There SHOULD be a validation error on 'number' field
          const numberErrors = errors.filter((e) => e.property === 'number');
          expect(numberErrors.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it('when noNumber is absent (undefined), empty number fails validation', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('', undefined, null), async (numberValue) => {
          const dto = createDto({
            noNumber: undefined,
            number: numberValue as any,
          });

          const errors = await validate(dto);

          // noNumber absent means number is required
          const numberErrors = errors.filter((e) => e.property === 'number');
          expect(numberErrors.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 4: Required address fields and CEP format in DTO validation
   *
   * For any CreateClinicDto where at least one of (cep, street, neighborhood,
   * city, state) is empty or missing, OR where cep does not match the format
   * of 8 numeric digits (with optional hyphen XXXXX-XXX), validation SHALL
   * reject the request.
   *
   * **Validates: Requirements 3.1, 3.2, 3.5**
   */
  describe('Property 4: Required address fields and CEP format validation', () => {
    const requiredAddressFields = ['cep', 'street', 'neighborhood', 'city', 'state'] as const;

    it('when at least one required address field is empty, validation rejects', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Pick at least one required field to make empty
          fc.subarray([...requiredAddressFields], {
            minLength: 1,
            maxLength: requiredAddressFields.length,
          }),
          fc.constantFrom('', undefined, null),
          async (fieldsToEmpty, emptyValue) => {
            const overrides: Record<string, any> = {};
            for (const field of fieldsToEmpty) {
              overrides[field] = emptyValue;
            }
            // If cep is not being emptied, keep a valid value
            if (!fieldsToEmpty.includes('cep')) {
              overrides['cep'] = '01001000';
            }

            const dto = createDto(overrides);
            const errors = await validate(dto);

            // At least one error should be present for the emptied fields
            const errorProperties = errors.map((e) => e.property);
            const hasRelevantError = fieldsToEmpty.some((f) => errorProperties.includes(f));
            expect(hasRelevantError).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('when CEP does not match 8 digits format, validation rejects', async () => {
      const invalidCepArb = fc.oneof(
        // Too short (less than 8 digits)
        digitStringRange(1, 7),
        // Too long (more than 8 digits, no hyphen)
        digitStringRange(9, 15),
        // Contains non-digit characters (not matching pattern)
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !/^\d{5}-?\d{3}$/.test(s)),
        // Has hyphen in wrong position
        fc.constantFrom('0100-1000', '010010-00', '1234-56789', '12-345678'),
      );

      await fc.assert(
        fc.asyncProperty(invalidCepArb, async (invalidCep) => {
          const dto = createDto({ cep: invalidCep });
          const errors = await validate(dto);

          // There should be a validation error on 'cep' field
          const cepErrors = errors.filter((e) => e.property === 'cep');
          expect(cepErrors.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it('valid CEP formats pass validation (positive control)', async () => {
      const validCepArb = fc.oneof(
        // 8 digits without hyphen: XXXXXXXX
        digitString(8),
        // With hyphen: XXXXX-XXX
        fc.tuple(digitString(5), digitString(3)).map(([prefix, suffix]) => `${prefix}-${suffix}`),
      );

      await fc.assert(
        fc.asyncProperty(validCepArb, async (validCep) => {
          const dto = createDto({ cep: validCep });
          const errors = await validate(dto);

          // No error on 'cep' field for valid CEP format
          const cepErrors = errors.filter((e) => e.property === 'cep');
          expect(cepErrors).toHaveLength(0);
        }),
        { numRuns: 100 },
      );
    });
  });
});
