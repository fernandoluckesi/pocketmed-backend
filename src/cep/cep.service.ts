import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CepResponseDto } from './dto/cep-response.dto';

@Injectable()
export class CepService {
  constructor(private readonly httpService: HttpService) {}

  async lookup(cep: string): Promise<CepResponseDto> {
    if (!/^\d{8}$/.test(cep)) {
      throw new BadRequestException('CEP deve conter exatamente 8 dígitos numéricos');
    }

    let data: any;
    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://viacep.com.br/ws/${cep}/json/`),
      );
      data = response.data;
    } catch {
      throw new BadGatewayException('Falha ao consultar serviço de CEP. Tente novamente.');
    }

    if (data.erro) {
      throw new NotFoundException('CEP não encontrado');
    }

    return {
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    };
  }
}
