import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import * as fc from 'fast-check';
import { CepService } from './cep.service';

describe('CepService', () => {
  let service: CepService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CepService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CepService>(CepService);
    httpService = module.get<HttpService>(HttpService);
  });

  /**
   * Property 1: ViaCEP response mapping preserves all address fields
   *
   * For any valid ViaCEP response object containing logradouro, bairro, localidade, and uf,
   * the CepService mapping SHALL produce a CepResponseDto where street equals logradouro,
   * neighborhood equals bairro, city equals localidade, and state equals uf.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  describe('Property 1: ViaCEP response mapping preserves all address fields', () => {
    const arbViaCepResponse = fc.record({
      logradouro: fc.string({ minLength: 1, maxLength: 200 }),
      bairro: fc.string({ minLength: 1, maxLength: 100 }),
      localidade: fc.string({ minLength: 1, maxLength: 100 }),
      uf: fc.stringMatching(/^[A-Z]{2}$/),
      cep: fc.stringMatching(/^\d{5}-\d{3}$/),
      complemento: fc.string({ maxLength: 100 }),
      ibge: fc.stringMatching(/^\d{7}$/),
      gia: fc.string({ maxLength: 10 }),
      ddd: fc.stringMatching(/^\d{2}$/),
      siafi: fc.stringMatching(/^\d{4}$/),
    });

    it('should map all ViaCEP fields correctly to CepResponseDto', async () => {
      await fc.assert(
        fc.asyncProperty(arbViaCepResponse, async (viaCepData) => {
          const validCep = '01001000';

          jest.spyOn(httpService, 'get').mockReturnValue(
            of({
              data: viaCepData,
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any,
            }) as any,
          );

          const result = await service.lookup(validCep);

          expect(result.street).toBe(viaCepData.logradouro);
          expect(result.neighborhood).toBe(viaCepData.bairro);
          expect(result.city).toBe(viaCepData.localidade);
          expect(result.state).toBe(viaCepData.uf);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 2: Invalid CEP format rejection at endpoint
   *
   * For any string that does not consist of exactly 8 numeric digits,
   * the CepService lookup SHALL reject the input with a BadRequestException.
   *
   * **Validates: Requirements 1.4**
   */
  describe('Property 2: Invalid CEP format rejection', () => {
    const arbInvalidCep = fc.oneof(
      // Too short (1-7 digits)
      fc.stringMatching(/^\d{1,7}$/),
      // Too long (9+ digits)
      fc.stringMatching(/^\d{9,15}$/),
      // Contains letters mixed with digits
      fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).filter((s) => !/^\d{8}$/.test(s)),
      // Contains special characters
      fc.stringMatching(/^[\d\-\.\s\/]{1,12}$/).filter((s) => !/^\d{8}$/.test(s)),
      // Empty string
      fc.constant(''),
      // Purely alphabetic
      fc.stringMatching(/^[a-zA-Z]{1,10}$/),
    );

    it('should throw BadRequestException for any non-8-digit string', async () => {
      await fc.assert(
        fc.asyncProperty(arbInvalidCep, async (invalidCep) => {
          await expect(service.lookup(invalidCep)).rejects.toThrow(BadRequestException);
        }),
        { numRuns: 100 },
      );
    });
  });
});
