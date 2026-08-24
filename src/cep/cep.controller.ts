import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CepService } from './cep.service';
import { CepResponseDto } from './dto/cep-response.dto';

@Controller('cep')
export class CepController {
  constructor(private readonly cepService: CepService) {}

  @Public()
  @Get(':cep')
  async lookup(@Param('cep') cep: string): Promise<CepResponseDto> {
    return this.cepService.lookup(cep);
  }
}
