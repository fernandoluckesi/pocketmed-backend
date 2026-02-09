# PocketMed API

API completa para gerenciamento de histórico médico construída com NestJS, MySQL e MinIO.

## Recursos

### Autenticação
- **3 tipos de cadastro de usuário:**
  - **Patient Shadow**: Paciente cadastrado por médico, recebe código por email para ativar conta
  - **Patient**: Paciente com cadastro completo e senha
  - **Doctor**: Médico com especialidade, CRM e CPF

- **Funcionalidades de autenticação:**
  - Login com email e senha
  - Ativação de conta shadow com código de verificação
  - Esqueci minha senha (código por email)
  - Alterar senha (com senha antiga)

### Pacientes (Patients)
- Listar todos pacientes (apenas médicos)
- Buscar paciente por ID
- Buscar pacientes por nome/email (mínimo 3 caracteres, apenas médicos)

### Dependentes (Dependents)
- Criar dependente (apenas pacientes)
- Listar dependentes do paciente
- Adicionar responsáveis ao dependente (apenas admin)
- Deletar dependente (apenas admin)

### Médicos (Doctors)
- Listar todos médicos
- Buscar médico por ID
- **Sistema de Permissões:**
  - Solicitar acesso a dados de paciente/dependente
  - Aprovar/rejeitar solicitações de acesso
  - Permissões vitalícias após aprovação

### Consultas (Appointments)
- Criar consulta (apenas médicos com permissão)
- Listar consultas
- Atualizar consulta (apenas médico criador)
- Responder à solicitação de consulta (pacientes)
- Deletar consulta (apenas médico criador)

### Medicamentos (Medications)
- Criar medicamento (apenas médicos com permissão)
- Listar medicamentos
- Atualizar medicamento (apenas médico criador)
- Deletar medicamento (apenas médico criador)

### Exames (Exams)
- Criar exame com upload de arquivo (apenas médicos com permissão)
- Listar exames
- Atualizar exame com arquivo (apenas médico criador)
- Deletar exame (apenas médico criador)

## Tecnologias

- **NestJS** - Framework Node.js
- **TypeScript** - Linguagem
- **MySQL** - Banco de dados
- **TypeORM** - ORM
- **JWT** - Autenticação
- **MinIO** - Armazenamento de imagens (S3-compatible)
- **Swagger** - Documentação da API
- **Docker** - Containerização

## Estrutura do Projeto

```
src/
├── auth/               # Módulo de autenticação
├── patients/           # Módulo de pacientes
├── dependents/         # Módulo de dependentes
├── doctors/            # Módulo de médicos
├── appointments/       # Módulo de consultas
├── medications/        # Módulo de medicamentos
├── exams/              # Módulo de exames
├── upload/             # Serviço de upload (MinIO)
├── email/              # Serviço de email
└── entities/           # Entidades do banco de dados
```

## Como Executar

### Pré-requisitos
- Docker
- Docker Compose

### Passo 1: Configurar variáveis de ambiente

As variáveis de ambiente já estão configuradas no `docker-compose.yml`. Para produção, altere:
- `JWT_SECRET`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `MINIO_ROOT_USER` e `MINIO_ROOT_PASSWORD`
- Configurações de email

### Passo 2: Iniciar os serviços

```bash
# Construir e iniciar todos os containers
docker-compose up --build

# Ou em modo detached (background)
docker-compose up -d --build
```

### Passo 3: Acessar a aplicação

- **API**: http://localhost:3000
- **Swagger Documentation**: http://localhost:3000/api/docs
- **MinIO Console**: http://localhost:9001
  - User: minioadmin
  - Password: minioadmin123

## Documentação da API

A documentação completa da API está disponível através do Swagger em:
```
http://localhost:3000/api/docs
```

## Endpoints Principais

### Autenticação
- `POST /auth/register/patient` - Registrar paciente
- `POST /auth/register/patient-shadow` - Registrar paciente shadow
- `POST /auth/register/doctor` - Registrar médico
- `POST /auth/login` - Login
- `POST /auth/send-verification-code` - Enviar código de verificação
- `POST /auth/activate-shadow-account` - Ativar conta shadow
- `POST /auth/forgot-password` - Solicitar código de recuperação
- `POST /auth/reset-password` - Resetar senha com código
- `POST /auth/change-password` - Alterar senha (autenticado)

### Pacientes
- `GET /patients` - Listar pacientes (médicos)
- `GET /patients/search?q=query` - Buscar pacientes (médicos)
- `GET /patients/:id` - Buscar paciente por ID

### Dependentes
- `POST /dependents` - Criar dependente (pacientes)
- `GET /dependents` - Listar dependentes
- `GET /dependents/:id` - Buscar dependente por ID
- `POST /dependents/:id/add-responsible` - Adicionar responsável
- `DELETE /dependents/:id` - Deletar dependente

### Médicos
- `GET /doctors` - Listar médicos
- `GET /doctors/:id` - Buscar médico por ID
- `POST /doctors/request-access` - Solicitar acesso (médicos)
- `GET /doctors/access-requests/me` - Minhas solicitações (médicos)
- `POST /doctors/access-requests/:id/respond` - Responder solicitação (pacientes)
- `GET /doctors/access-requests/patient/me` - Solicitações para mim (pacientes)
- `GET /doctors/access-requests/dependents/me` - Solicitações para meus dependentes (pacientes)

### Consultas
- `POST /appointments` - Criar consulta (médicos)
- `GET /appointments` - Listar consultas
- `GET /appointments/:id` - Buscar consulta por ID
- `PUT /appointments/:id` - Atualizar consulta (médicos)
- `POST /appointments/:id/respond` - Responder consulta (pacientes)
- `DELETE /appointments/:id` - Deletar consulta (médicos)

### Medicamentos
- `POST /medications` - Criar medicamento (médicos)
- `GET /medications` - Listar medicamentos
- `GET /medications/:id` - Buscar medicamento por ID
- `PUT /medications/:id` - Atualizar medicamento (médicos)
- `DELETE /medications/:id` - Deletar medicamento (médicos)

### Exames
- `POST /exams` - Criar exame (médicos)
- `GET /exams` - Listar exames
- `GET /exams/:id` - Buscar exame por ID
- `PUT /exams/:id` - Atualizar exame (médicos)
- `DELETE /exams/:id` - Deletar exame (médicos)

## Sistema de Permissões

1. Médico solicita acesso aos dados do paciente/dependente
2. Paciente (ou responsável) recebe a solicitação
3. Paciente aprova ou rejeita
4. Se aprovado, permissão é concedida permanentemente
5. Médico pode criar consultas, medicamentos e exames

## Validações

- Campos obrigatórios em todos os endpoints
- Validação de email
- Senhas com mínimo de 6 caracteres
- Busca de pacientes requer mínimo 3 caracteres
- Verificação de permissões em todas as operações
- Validação de tipos de arquivo para uploads

## Upload de Arquivos

Arquivos são armazenados no MinIO e retornados como URLs públicas:
- Fotos de perfil: `/profiles`
- Resultados de exames: `/exam-results`

## Email

O sistema envia emails para:
- Códigos de verificação (ativação de conta shadow)
- Códigos de recuperação de senha

**Nota**: Configure as variáveis de email no `docker-compose.yml` para funcionamento correto.

## Segurança

- Autenticação JWT
- Senhas criptografadas com bcrypt
- Guards de autenticação e autorização
- Validação de entrada em todos os endpoints
- Controle de acesso baseado em roles e permissões

## Desenvolvimento

### Instalar dependências localmente
```bash
npm install
```

### Executar em modo desenvolvimento
```bash
npm run start:dev
```

### Build
```bash
npm run build
```

### Testes
```bash
npm run test
```

## Comandos Docker

```bash
# Parar todos os containers
docker-compose down

# Parar e remover volumes (apaga dados do banco)
docker-compose down -v

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f api
docker-compose logs -f mysql
docker-compose logs -f minio

# Reconstruir apenas um serviço
docker-compose up -d --build api
```

## Licença

MIT
# pocketmed-backend-v2
