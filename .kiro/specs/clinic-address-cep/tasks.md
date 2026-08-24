# Implementation Plan: clinic-address-cep

## Overview

Implementação de campos de endereço com auto-preenchimento via CEP no formulário de criação de clínica. A abordagem é backend-first: primeiro o módulo CEP e a persistência, depois o frontend consome os endpoints prontos. Property-based tests com fast-check validam propriedades de corretude definidas no design.

## Tasks

- [x] 1. Backend — Módulo CEP (Controller, Service, DTO)
  - [x] 1.1 Criar o módulo `src/cep/` com CepModule, CepService, CepController e CepResponseDto
    - Criar `src/cep/cep.module.ts` importando `HttpModule` com timeout de 5000ms
    - Criar `src/cep/dto/cep-response.dto.ts` com campos `street`, `neighborhood`, `city`, `state`
    - Criar `src/cep/cep.service.ts` com método `lookup(cep: string)` que valida formato (8 dígitos numéricos), chama ViaCEP, mapeia resposta e trata erros (400, 404, 502)
    - Criar `src/cep/cep.controller.ts` com endpoint `@Public() @Get(':cep')` que chama o service
    - Registrar `CepModule` no `AppModule`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x]\* 1.2 Write property test: ViaCEP response mapping preserves all address fields
    - **Property 1: ViaCEP response mapping preserves all address fields**
    - Instalar `fast-check` como devDependency
    - Criar `src/cep/cep.service.spec.ts` com arbitrary para objetos ViaCEP válidos
    - Verificar que `street === logradouro`, `neighborhood === bairro`, `city === localidade`, `state === uf`
    - Mínimo 100 iterações
    - **Validates: Requirements 1.1, 1.2**

  - [x]\* 1.3 Write property test: Invalid CEP format rejection
    - **Property 2: Invalid CEP format rejection at endpoint**
    - Criar arbitrary que gera strings que NÃO são 8 dígitos numéricos
    - Verificar que `lookup()` lança `BadRequestException` para todos os inputs inválidos
    - Mínimo 100 iterações
    - **Validates: Requirements 1.4**

  - [x]\* 1.4 Write unit tests for CepController
    - Criar `src/cep/cep.controller.spec.ts`
    - Testar cenários: CEP válido retorna 200, CEP não encontrado retorna 404, formato inválido retorna 400, ViaCEP indisponível retorna 502
    - Usar mocks do CepService
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Backend — Entidade Clinic e Migration
  - [x] 2.1 Adicionar campos de endereço à entidade Clinic
    - Editar `src/entities/clinic.entity.ts` adicionando colunas: `cep` (varchar 9, nullable), `street` (varchar 255, nullable), `number` (varchar 20, nullable), `complement` (varchar 255, nullable), `neighborhood` (varchar 100, nullable), `city` (varchar 100, nullable), `state` (varchar 2, nullable), `noNumber` (boolean, default false)
    - Todas nullable para compatibilidade retroativa com clínicas existentes
    - _Requirements: 2.1_

  - [x] 2.2 Criar migration TypeORM para colunas de endereço
    - Criar `src/database/migrations/<timestamp>-AddAddressFieldsToClinics.ts`
    - Método `up`: ALTER TABLE clinics ADD COLUMN para cada campo
    - Método `down`: ALTER TABLE clinics DROP COLUMN para cada campo (ordem reversa)
    - _Requirements: 2.4_

- [x] 3. Backend — Validação no CreateClinicDto
  - [x] 3.1 Adicionar campos de endereço com validação ao CreateClinicDto
    - Editar `src/clinics/dto/create-clinic.dto.ts`
    - Adicionar `cep` com `@IsNotEmpty`, `@Matches(/^\d{5}-?\d{3}$/)`
    - Adicionar `street` com `@IsNotEmpty`, `@MaxLength(255)`
    - Adicionar `number` com `@ValidateIf((o) => !o.noNumber)`, `@IsNotEmpty`, `@MaxLength(20)`
    - Adicionar `complement` com `@IsOptional`, `@MaxLength(255)`
    - Adicionar `neighborhood` com `@IsNotEmpty`, `@MaxLength(100)`
    - Adicionar `city` com `@IsNotEmpty`, `@MaxLength(100)`
    - Adicionar `state` com `@IsNotEmpty`, `@MaxLength(2)`
    - Adicionar `noNumber` com `@IsOptional`, `@IsBoolean`
    - Incluir `@ApiProperty` decorators para Swagger
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x]\* 3.2 Write property test: Conditional number validation based on noNumber flag
    - **Property 3: Conditional number validation based on noNumber flag**
    - Criar `src/clinics/dto/create-clinic.dto.spec.ts`
    - Gerar DTOs com `noNumber: true` e `number` vazio → validação deve passar
    - Gerar DTOs com `noNumber: false` e `number` vazio → validação deve falhar
    - Usar `class-validator` `validate()` diretamente nos objetos gerados
    - Mínimo 100 iterações
    - **Validates: Requirements 2.2, 2.3, 3.3, 3.4**

  - [x]\* 3.3 Write property test: Required address fields and CEP format validation
    - **Property 4: Required address fields and CEP format in DTO validation**
    - Gerar DTOs onde pelo menos um campo obrigatório (cep, street, neighborhood, city, state) está vazio
    - Verificar que `validate()` retorna erros
    - Gerar DTOs com CEP fora do formato 8 dígitos (com ou sem hífen)
    - Verificar rejeição
    - Mínimo 100 iterações
    - **Validates: Requirements 3.1, 3.2, 3.5**

- [x] 4. Backend — Integrar endereço no fluxo de criação de clínica
  - [x] 4.1 Atualizar ClinicsService para persistir campos de endereço
    - Editar `src/clinics/clinics.service.ts` para mapear os novos campos do DTO na criação da entidade Clinic
    - Garantir que campos de endereço são salvos no banco ao criar clínica
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Checkpoint — Backend completo
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend — Integração com endpoint CEP
  - [x] 6.1 Criar service/hook para consulta de CEP no frontend
    - Criar função `fetchCep(cep: string)` que chama `GET /cep/:cep` no backend
    - Tratar respostas: 200 (retorna dados), 404 (CEP não encontrado), 502/rede (erro externo)
    - Retornar objeto tipado `{ street, neighborhood, city, state }` ou indicador de erro
    - _Requirements: 4.1, 4.4, 4.5_

- [x] 7. Frontend — Campos de endereço no formulário de signup
  - [x] 7.1 Adicionar campos de endereço ao formulário Signup.tsx
    - Adicionar campos Formik: `cep`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `noNumber`
    - Implementar layout responsivo: campos menores (CEP, número, estado) lado a lado; campos maiores (endereço, bairro, cidade, complemento) em largura total
    - Implementar Checkbox "Sem Número" que desabilita e limpa o campo número quando marcado
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_

  - [x] 7.2 Implementar auto-preenchimento de endereço por CEP
    - Detectar quando CEP atinge 8 dígitos numéricos (onChange ou useEffect)
    - Chamar `fetchCep()` e preencher campos `street`, `neighborhood`, `city`, `state`
    - Exibir indicador de loading no campo CEP durante a consulta
    - Exibir mensagem informativa se CEP não encontrado (404) ou erro de rede (502)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.3 Implementar schema de validação Yup para campos de endereço
    - Estender schema Yup existente no Signup com validações condicionais
    - `cep`: obrigatório, formato 8 dígitos
    - `street`, `neighborhood`, `city`, `state`: obrigatórios
    - `number`: obrigatório condicionalmente (quando `noNumber` é false)
    - `complement`: opcional
    - Mensagens de erro individuais em português
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x]\* 7.4 Write property test: Frontend auto-fill populates all address fields
    - **Property 5: Frontend auto-fill populates all address fields from CEP response**
    - Gerar objetos `CepResponseDto` válidos com arbitrary para street, neighborhood, city, state
    - Simular chamada bem-sucedida e verificar que todos os 4 campos do formulário ficam preenchidos (non-empty)
    - Usar Testing Library + fast-check
    - Mínimo 100 iterações
    - **Validates: Requirements 4.3**

  - [x]\* 7.5 Write property test: Frontend validation shows individual error per missing field
    - **Property 6: Frontend validation shows individual error for each missing required field**
    - Gerar subconjuntos não-vazios dos campos obrigatórios (cep, street, number, neighborhood, city, state) deixados vazios
    - Submeter formulário e verificar que cada campo vazio exibe mensagem de erro correspondente
    - Usar Testing Library + fast-check
    - Mínimo 100 iterações
    - **Validates: Requirements 7.1, 7.2**

  - [x]\* 7.6 Write unit tests for Signup address fields
    - Testar comportamento do Checkbox "Sem Número" (desabilita/habilita campo número)
    - Testar indicador de loading durante consulta CEP
    - Testar exibição de mensagens informativas em caso de erro
    - Testar layout responsivo básico (campos renderizados)
    - _Requirements: 4.2, 6.1, 6.2, 6.3_

- [x] 8. Final checkpoint — Todos os testes passam
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser ignoradas para um MVP mais rápido
- Cada task referencia requirements específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude (fast-check)
- Unit tests validam cenários específicos e casos de borda
- A ordem backend-first permite que o frontend consuma endpoints já prontos
- `fast-check` deve ser instalado como devDependency no task 1.2
- O frontend (pocketmed-web) é um projeto separado — tasks 6 e 7 podem requerer contexto desse repositório

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.2"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["7.1", "7.3"] },
    { "id": 6, "tasks": ["7.2"] },
    { "id": 7, "tasks": ["7.4", "7.5", "7.6"] }
  ]
}
```
