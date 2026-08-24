import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, BadGatewayException } from '@nestjs/common';
import { CepController } from './cep.controller';
import { CepService } from './cep.service';

describe('CepController', () => {
  let controller: CepController;
  let cepService: jest.Mocked<CepService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CepController],
      providers: [
        {
          provide: CepService,
          useValue: {
            lookup: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CepController>(CepController);
    cepService = module.get(CepService);
  });

  describe('lookup', () => {
    it('should return 200 with address data for a valid CEP', async () => {
      const mockResponse = {
        street: 'Praça da Sé',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP',
      };

      cepService.lookup.mockResolvedValue(mockResponse);

      const result = await controller.lookup('01001000');

      expect(result).toEqual(mockResponse);
      expect(result.street).toBe('Praça da Sé');
      expect(result.neighborhood).toBe('Sé');
      expect(result.city).toBe('São Paulo');
      expect(result.state).toBe('SP');
      expect(cepService.lookup).toHaveBeenCalledWith('01001000');
    });

    it('should propagate NotFoundException when CEP is not found (404)', async () => {
      cepService.lookup.mockRejectedValue(new NotFoundException('CEP não encontrado'));

      await expect(controller.lookup('99999999')).rejects.toThrow(NotFoundException);
      expect(cepService.lookup).toHaveBeenCalledWith('99999999');
    });

    it('should propagate BadRequestException for invalid CEP format (400)', async () => {
      cepService.lookup.mockRejectedValue(
        new BadRequestException('CEP deve conter exatamente 8 dígitos numéricos'),
      );

      await expect(controller.lookup('123')).rejects.toThrow(BadRequestException);
      expect(cepService.lookup).toHaveBeenCalledWith('123');
    });

    it('should propagate BadGatewayException when ViaCEP is unavailable (502)', async () => {
      cepService.lookup.mockRejectedValue(
        new BadGatewayException('Falha ao consultar serviço de CEP. Tente novamente.'),
      );

      await expect(controller.lookup('01001000')).rejects.toThrow(BadGatewayException);
      expect(cepService.lookup).toHaveBeenCalledWith('01001000');
    });
  });
});
