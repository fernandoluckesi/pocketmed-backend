# Guia de Desenvolvimento - PocketMed API

## Desenvolvimento Local (sem Docker para a API)

Se você prefere executar apenas MySQL e MinIO no Docker e a API localmente:

### Passo 1: Iniciar apenas MySQL e MinIO
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Passo 2: Instalar dependências
```bash
npm install
```

### Passo 3: Configurar .env
Certifique-se de que o arquivo `.env` está configurado para desenvolvimento local:
```env
DB_HOST=localhost
DB_PORT=3306
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
```

### Passo 4: Executar a aplicação em modo desenvolvimento
```bash
npm run start:dev
```

A API estará disponível em http://localhost:3000

## Executar Tudo com Docker

Para executar MySQL, MinIO e a API juntos no Docker:

```bash
docker-compose up --build
```

## Estrutura do Projeto

```
src/
├── auth/                    # Autenticação e autorização
│   ├── decorators/          # Decorators customizados
│   ├── dto/                 # Data Transfer Objects
│   ├── guards/              # Guards de autenticação
│   ├── strategies/          # Estratégias JWT
│   ├── auth.controller.ts   # Controller de autenticação
│   ├── auth.module.ts       # Módulo de autenticação
│   └── auth.service.ts      # Serviço de autenticação
│
├── patients/                # Gerenciamento de pacientes
│   ├── patients.controller.ts
│   ├── patients.module.ts
│   └── patients.service.ts
│
├── dependents/              # Gerenciamento de dependentes
│   ├── dto/
│   ├── dependents.controller.ts
│   ├── dependents.module.ts
│   └── dependents.service.ts
│
├── doctors/                 # Gerenciamento de médicos
│   ├── dto/
│   ├── doctors.controller.ts
│   ├── doctors.module.ts
│   └── doctors.service.ts
│
├── appointments/            # Gerenciamento de consultas
│   ├── dto/
│   ├── appointments.controller.ts
│   ├── appointments.module.ts
│   └── appointments.service.ts
│
├── medications/             # Gerenciamento de medicamentos
│   ├── dto/
│   ├── medications.controller.ts
│   ├── medications.module.ts
│   └── medications.service.ts
│
├── exams/                   # Gerenciamento de exames
│   ├── dto/
│   ├── exams.controller.ts
│   ├── exams.module.ts
│   └── exams.service.ts
│
├── upload/                  # Serviço de upload (MinIO)
│   ├── upload.module.ts
│   └── upload.service.ts
│
├── email/                   # Serviço de email
│   ├── email.module.ts
│   └── email.service.ts
│
├── entities/                # Entidades do banco de dados
│   ├── user.entity.ts
│   ├── patient.entity.ts
│   ├── doctor.entity.ts
│   ├── dependent.entity.ts
│   ├── appointment.entity.ts
│   ├── medication.entity.ts
│   ├── exam.entity.ts
│   ├── doctor-access-request.entity.ts
│   └── doctor-permission.entity.ts
│
├── app.module.ts            # Módulo principal
├── app.controller.ts        # Controller principal
├── app.service.ts           # Serviço principal
└── main.ts                  # Entry point
```

## Fluxo de Autenticação

### 1. Registro de Paciente Normal
```
POST /auth/register/patient
Body: { name, email, password, gender, phone, birthDate, profileImage? }
Response: { user, token }
```

### 2. Registro de Paciente Shadow (por médico)
```
POST /auth/register/patient-shadow
Body: { name, email, gender, phone, birthDate, doctorCreatorId, profileImage? }
Response: { message, user }
Email enviado com código de verificação
```

### 3. Ativação de Conta Shadow
```
POST /auth/send-verification-code
Body: { email }
Response: { message }

POST /auth/activate-shadow-account
Body: { email, verificationCode, password }
Response: { message, user, token }
```

### 4. Login
```
POST /auth/login
Body: { email, password }
Response: { user, token }
```

### 5. Recuperação de Senha
```
POST /auth/forgot-password
Body: { email }
Response: { message }
Email enviado com código

POST /auth/reset-password
Body: { email, resetCode, newPassword }
Response: { message }
```

## Fluxo de Permissões

### 1. Médico Solicita Acesso
```
POST /doctors/request-access
Headers: { Authorization: Bearer <doctor_token> }
Body: { patientId: "uuid" } ou { dependentId: "uuid" }
Response: { accessRequest }
```

### 2. Paciente Recebe Solicitações
```
GET /doctors/access-requests/patient/me
Headers: { Authorization: Bearer <patient_token> }
Response: [ { id, doctor, message, status, ... } ]

GET /doctors/access-requests/dependents/me
Headers: { Authorization: Bearer <patient_token> }
Response: [ { id, doctor, dependent, message, status, ... } ]
```

### 3. Paciente Aprova/Rejeita
```
POST /doctors/access-requests/:id/respond
Headers: { Authorization: Bearer <patient_token> }
Body: { status: "approved" } ou { status: "rejected" }
Response: { message, request }
```

### 4. Médico Pode Criar Recursos
Após aprovação, o médico pode:
- Criar consultas: `POST /appointments`
- Criar medicamentos: `POST /medications`
- Criar exames: `POST /exams`

## Endpoints Úteis para Desenvolvimento

### Health Check
```bash
curl http://localhost:3000
```

### Swagger Documentation
```
http://localhost:3000/api/docs
```

### MinIO Console
```
http://localhost:9001
User: minioadmin
Password: minioadmin123
```

## Comandos NPM

```bash
# Desenvolvimento
npm run start:dev

# Build
npm run build

# Produção
npm run start:prod

# Testes
npm run test
npm run test:watch
npm run test:cov

# Linting
npm run lint
npm run format
```

## Debugging

### VSCode Debug Configuration

Crie `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector",
      "port": 9229,
      "autoAttachChildProcesses": true
    }
  ]
}
```

### Logs
```bash
# Ver logs do Docker
docker-compose logs -f api

# Ver logs do MySQL
docker-compose logs -f mysql

# Ver logs do MinIO
docker-compose logs -f minio
```

## Testando a API

### Usar cURL
```bash
# Registrar paciente
curl -X POST http://localhost:3000/auth/register/patient \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@email.com",
    "password": "senha123",
    "gender": "Masculino",
    "phone": "(11) 99999-1234",
    "birthDate": "1990-01-01"
  }'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@email.com",
    "password": "senha123"
  }'

# Buscar paciente (com token)
curl -X GET http://localhost:3000/patients/:id \
  -H "Authorization: Bearer <seu_token>"
```

### Usar Swagger UI
Acesse http://localhost:3000/api/docs e use a interface interativa.

## Problemas Comuns

### Erro de conexão com MySQL
- Verifique se o MySQL está rodando: `docker-compose ps`
- Verifique as credenciais no `.env`
- Aguarde o MySQL inicializar completamente

### Erro de conexão com MinIO
- Verifique se o MinIO está rodando: `docker-compose ps`
- Acesse o console: http://localhost:9001
- Verifique as credenciais no `.env`

### Erro de envio de email
- Configure corretamente as credenciais de email no `.env`
- Para Gmail, use uma senha de aplicativo, não a senha normal

## Boas Práticas

1. **Sempre use validação de DTOs**
2. **Implemente tratamento de erros apropriado**
3. **Mantenha os serviços desacoplados**
4. **Use guards para proteger rotas**
5. **Documente endpoints no Swagger**
6. **Escreva testes para funcionalidades críticas**
7. **Não commite arquivos sensíveis (.env)**
8. **Use transactions para operações complexas**
9. **Valide permissões antes de operações sensíveis**
10. **Mantenha logs informativos**

## Contribuindo

1. Crie uma branch para sua feature: `git checkout -b feature/nova-feature`
2. Faça commit das mudanças: `git commit -m 'Adiciona nova feature'`
3. Push para a branch: `git push origin feature/nova-feature`
4. Abra um Pull Request

## Suporte

Para problemas ou dúvidas, abra uma issue no repositório.
