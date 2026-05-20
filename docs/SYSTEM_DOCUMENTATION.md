# PocketMed API — Documentação do Sistema

## Visão Geral

O PocketMed é uma plataforma de gerenciamento de histórico médico que conecta médicos, pacientes e clínicas. A API é construída com NestJS, TypeORM e MySQL.

- **Framework:** NestJS 10.x
- **ORM:** TypeORM 0.3.x
- **Banco de Dados:** MySQL 8.0
- **Autenticação:** JWT (passport-jwt)
- **Upload de Arquivos:** MinIO (S3-compatible)
- **Push Notifications:** Expo Server SDK
- **Email:** Nodemailer
- **Documentação Swagger:** `/api/docs`

---

## Swagger (Documentação Interativa da API)

A documentação Swagger está disponível em:

```
GET /api/docs        → Interface interativa
GET /api/docs-json   → Especificação OpenAPI em JSON
```

Para autenticar no Swagger:

1. Faça login via `POST /auth/login`
2. Copie o `access_token` retornado
3. Clique em "Authorize" no Swagger e cole: `Bearer <token>`

---

## Arquitetura de Módulos

```
AppModule
├── AuthModule            → Registro, login, recuperação de senha
├── PatientsModule        → Gestão de pacientes
├── DependentsModule      → Dependentes de pacientes
├── DoctorsModule         → Médicos e controle de acesso
├── AppointmentsModule    → Consultas médicas
├── MedicationsModule     → Prescrições de medicamentos
├── ExamsModule           → Exames médicos
├── AvailabilityModule    → Disponibilidade do médico
├── NotificationsModule   → Push notifications e centro de notificações
├── ClinicAdminModule     → Administração de clínicas
├── ExamCatalogModule     → Catálogo de exames (público)
├── ExamSchedulingModule  → Agendamento de exames pelo paciente
├── UploadModule          → Upload de imagens (MinIO)
└── EmailModule           → Envio de emails (SMTP)
```

---

## Fluxos Principais do Sistema

### 1. Registro e Autenticação

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE AUTENTICAÇÃO                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Paciente]──POST /auth/register/patient──→ Conta criada     │
│  [Médico]───POST /auth/register/doctor───→ Conta criada      │
│                                                              │
│  [Qualquer]─POST /auth/login─────────────→ JWT Token         │
│                                                              │
│  [Médico]───POST /auth/register/patient-shadow──→            │
│             Paciente "sombra" criado (sem senha)              │
│                                                              │
│  [Shadow]───POST /auth/send-verification-code──→             │
│             POST /auth/activate-shadow-account──→             │
│             Conta ativada com senha                           │
│                                                              │
│  [Qualquer]─POST /auth/forgot-password──→ Código enviado     │
│             POST /auth/reset-password───→ Senha redefinida    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Controle de Acesso Médico-Paciente

```
┌─────────────────────────────────────────────────────────────┐
│              FLUXO DE ACESSO A PRONTUÁRIO                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Médico]──POST /doctors/request-access──→ Solicitação       │
│            (status: PENDING)                                 │
│                                                              │
│  [Paciente]──GET /doctors/access-requests/patient/me──→      │
│              Vê solicitações pendentes                        │
│                                                              │
│  [Paciente]──POST /doctors/access-requests/:id/respond──→    │
│              status: APPROVED → DoctorPermission criada       │
│              status: REJECTED → Acesso negado                │
│                                                              │
│  [Paciente]──PATCH /doctors/permissions/:id/revoke──→        │
│              Permissão revogada (isActive=false)              │
│                                                              │
│  [Médico]──DELETE /doctors/access-requests/:id──→             │
│            Cancela solicitação pendente                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. Consultas Médicas

```
┌─────────────────────────────────────────────────────────────┐
│                 FLUXO DE CONSULTAS                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Médico/Paciente]──POST /appointments──→ Consulta criada    │
│                     (status: PENDING)                        │
│                                                              │
│  [Paciente]──POST /appointments/:id/respond──→               │
│              APPROVED ou REJECTED                             │
│                                                              │
│  [Médico]──PUT /appointments/:id──→                          │
│            Atualiza feedback, instruções, marca completa      │
│                                                              │
│  Consulta pode gerar:                                        │
│    → Medicamentos (POST /medications)                        │
│    → Exames (POST /exams)                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. Sistema de Clínicas

```
┌─────────────────────────────────────────────────────────────┐
│                 FLUXO DE CLÍNICA                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Roles: admin | doctor | secretary                           │
│                                                              │
│  [Admin]──GET /clinic-admin/overview──→ Visão geral          │
│  [Admin]──POST /clinic-admin/members──→ Adiciona membro      │
│  [Admin]──PATCH /clinic-admin/members/:id/role──→            │
│           Altera role do membro                              │
│  [Admin]──DELETE /clinic-admin/members/:id──→ Remove          │
│  [Admin]──POST /clinic-admin/doctors/shadow──→               │
│           Cria médico shadow na clínica                       │
│                                                              │
│  [Admin/Secretary]──GET /clinic-admin/patients──→            │
│                     Pacientes vinculados aos médicos          │
│  [Admin/Secretary]──GET /clinic-admin/doctors──→             │
│                     Médicos da clínica                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Diagrama de Relacionamento entre Tabelas (ERD)

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     doctors      │       │     patients     │       │   dependents     │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK, UUID)    │       │ id (PK, UUID)    │       │ id (PK, UUID)    │
│ name             │       │ name             │       │ name             │
│ email (unique)   │       │ email (unique)   │       │ gender           │
│ password         │       │ password         │       │ type             │
│ gender           │       │ gender           │       │ birthDate        │
│ phone            │       │ phone            │       │ profileImage     │
│ birthDate        │       │ birthDate        │       │ adminResponsibleId│
│ profileImage     │       │ profileImage     │       └────────┬─────────┘
│ specialty        │       │ type             │                │
│ crm              │       │ isShadow         │                │ ManyToOne
│ cpf              │       │ doctorCreatorId──┼───┐            │
│ isShadow         │       └────────┬─────────┘   │            ▼
│ type             │                │              │   ┌──────────────────┐
└────────┬─────────┘                │              │   │dependent_respon- │
         │                          │              │   │sibles (join)     │
         │                          │              │   ├──────────────────┤
         │                          │              └──▶│ dependentId (FK) │
         │                          │                  │ patientId (FK)   │
         │                          │                  └──────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          appointments                                 │
├──────────────────────────────────────────────────────────────────────┤
│ id (PK, UUID) │ doctorId (FK→doctors) │ patientId (FK→patients)      │
│ dependentId (FK→dependents) │ createdByPatientId (FK→patients)       │
│ doctorCrm │ doctorName │ doctorSpecialty │ reason │ dateTime          │
│ isCompleted │ doctorFeedback │ doctorInstructions                     │
│ status (enum: pending/approved/rejected/completed)                    │
└──────────────────────────────────────────────────────────────────────┘
         │                                    │
         │ OneToMany                          │ OneToMany
         ▼                                    ▼
┌──────────────────┐              ┌──────────────────┐
│   medications    │              │      exams       │
├──────────────────┤              ├──────────────────┤
│ id (PK, UUID)    │              │ id (PK, UUID)    │
│ name             │              │ name             │
│ dosage           │              │ type (enum)      │
│ frequency (enum) │              │ description      │
│ times (json)     │              │ scheduledDate    │
│ startDate        │              │ status (enum)    │
│ endDate          │              │ results          │
│ duration         │              │ resultFile       │
│ instructions     │              │ observations     │
│ isActive         │              │ laboratory       │
│ isFinished       │              │ doctorId (FK)    │
│ doctorId (FK)    │              │ patientId (FK)   │
│ patientId (FK)   │              │ dependentId (FK) │
│ dependentId (FK) │              │ appointmentId(FK)│
│ appointmentId(FK)│              └──────────────────┘
└──────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                     CONTROLE DE ACESSO                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────┐    ┌─────────────────────────┐          │
│  │ doctor_access_requests  │    │   doctor_permissions    │          │
│  ├─────────────────────────┤    ├─────────────────────────┤          │
│  │ id (PK, UUID)           │    │ id (PK, UUID)           │          │
│  │ doctorId (FK→doctors)   │    │ doctorId (FK→doctors)   │          │
│  │ patientId (FK→patients) │    │ patientId (FK→patients) │          │
│  │ dependentId (FK)        │    │ dependentId (FK)        │          │
│  │ status (enum)           │    │ isActive                │          │
│  │ message                 │    │ grantedAt               │          │
│  └─────────────────────────┘    │ revokedAt               │          │
│                                  └─────────────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      SISTEMA DE CLÍNICAS                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────┐     ┌───────────────────┐     ┌──────────────────┐   │
│  │  clinics   │◀────│ clinic_memberships │────▶│    doctors       │   │
│  ├────────────┤     ├───────────────────┤     └──────────────────┘   │
│  │ id (PK)    │     │ id (PK)           │                            │
│  │ name       │     │ clinicId (FK)     │     ┌──────────────────┐   │
│  │ cnpj       │     │ professionalId(FK)│     │clinic_admin_     │   │
│  │ isActive   │     │ role (enum)       │     │profiles          │   │
│  └────────────┘     │ isActive          │     ├──────────────────┤   │
│                      │ invitedBy         │     │ professionalId   │   │
│                      └───────────────────┘     │ name, email, etc │   │
│                                                │ clinicId (FK)    │   │
│                      ┌──────────────────┐      └──────────────────┘   │
│                      │secretary_profiles │                            │
│                      ├──────────────────┤                            │
│                      │ professionalId   │                            │
│                      │ name, email, etc │                            │
│                      │ clinicId (FK)    │                            │
│                      └──────────────────┘                            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    DISPONIBILIDADE DO MÉDICO                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐      │
│  │  availability_rules    │    │  availability_exceptions    │      │
│  ├─────────────────────────┤    ├─────────────────────────────┤      │
│  │ id (PK, UUID)           │    │ id (PK, UUID)               │      │
│  │ name                    │    │ type (single/range)          │      │
│  │ weekly (json)           │    │ date / startDate / endDate   │      │
│  │ duration (min)          │    │ fullDay                      │      │
│  │ buffer (min)            │    │ startTime / endTime          │      │
│  │ doctorId (FK→doctors)   │    │ reason                       │      │
│  └─────────────────────────┘    │ doctorId (FK→doctors)        │      │
│                                  └─────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                   CATÁLOGO E AGENDAMENTO DE EXAMES                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────┐    ┌──────────────────┐                          │
│  │exam_categories │◀───│   exam_catalog   │                          │
│  ├────────────────┤    ├──────────────────┤                          │
│  │ id (PK)        │    │ id (PK)          │                          │
│  │ name           │    │ name             │                          │
│  └────────────────┘    │ synonyms         │                          │
│                         │ categoryId (FK)  │                          │
│                         │ preparationInstr │                          │
│                         │ estimatedDuration│                          │
│                         │ price            │                          │
│                         └────────┬─────────┘                          │
│                                  │                                    │
│  ┌──────────────────┐    ┌──────┴───────────────┐                    │
│  │  exam_schedules  │◀───│ exam_schedule_items  │                    │
│  ├──────────────────┤    ├──────────────────────┤                    │
│  │ id (PK)          │    │ id (PK)              │                    │
│  │ patientId (FK)   │    │ examScheduleId (FK)  │                    │
│  │ scheduledDateTime│    │ examCatalogId (FK)   │                    │
│  │ status (enum)    │    │ customExamName       │                    │
│  └──────────────────┘    └──────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                        NOTIFICAÇÕES                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐         ┌──────────────────┐                   │
│  │  device_tokens   │         │  notifications   │                   │
│  ├──────────────────┤         ├──────────────────┤                   │
│  │ id (PK)          │         │ id (PK)          │                   │
│  │ userId           │         │ userId           │                   │
│  │ userType         │         │ userType         │                   │
│  │ expoPushToken    │         │ type             │                   │
│  │ platform         │         │ title            │                   │
│  │ isActive         │         │ body             │                   │
│  └──────────────────┘         │ data (json)      │                   │
│                                │ relatedEntityId  │                   │
│                                │ isRead           │                   │
│                                └──────────────────┘                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Endpoints da API (Resumo)

### Auth (`/auth`)

| Método | Rota                          | Acesso                 | Descrição                    |
| ------ | ----------------------------- | ---------------------- | ---------------------------- |
| POST   | /auth/register/patient        | Público                | Registrar paciente           |
| POST   | /auth/register/doctor         | Público                | Registrar médico             |
| POST   | /auth/register/patient-shadow | Doctor/Admin/Secretary | Criar paciente shadow        |
| POST   | /auth/login                   | Público                | Login (retorna JWT)          |
| POST   | /auth/send-verification-code  | Público                | Enviar código de verificação |
| POST   | /auth/activate-shadow-account | Público                | Ativar conta shadow          |
| POST   | /auth/forgot-password         | Público                | Solicitar reset de senha     |
| POST   | /auth/reset-password          | Público                | Resetar senha com código     |
| POST   | /auth/change-password         | Autenticado            | Alterar senha                |

### Patients (`/patients`)

| Método | Rota                    | Acesso      | Descrição            |
| ------ | ----------------------- | ----------- | -------------------- |
| GET    | /patients/stats/summary | Autenticado | Resumo de pacientes  |
| GET    | /patients/my            | Autenticado | Pacientes acessíveis |
| GET    | /patients               | Autenticado | Todos os pacientes   |
| GET    | /patients/search?q=     | Autenticado | Buscar pacientes     |
| GET    | /patients/:id           | Autenticado | Paciente por ID      |

### Doctors (`/doctors`)

| Método | Rota                                   | Acesso      | Descrição                   |
| ------ | -------------------------------------- | ----------- | --------------------------- |
| GET    | /doctors                               | Autenticado | Listar médicos              |
| GET    | /doctors/:id                           | Autenticado | Médico por ID               |
| POST   | /doctors/request-access                | Doctor      | Solicitar acesso            |
| GET    | /doctors/access-requests/me            | Doctor      | Minhas solicitações         |
| DELETE | /doctors/access-requests/:id           | Doctor      | Cancelar solicitação        |
| POST   | /doctors/access-requests/:id/respond   | Patient     | Responder solicitação       |
| GET    | /doctors/access-requests/patient/me    | Patient     | Solicitações recebidas      |
| GET    | /doctors/access-requests/dependents/me | Patient     | Solicitações p/ dependentes |
| GET    | /doctors/permissions/patient/me        | Patient     | Permissões ativas           |
| PATCH  | /doctors/permissions/:id/revoke        | Patient     | Revogar permissão           |
| GET    | /doctors/search/crm?crm=&state=        | Autenticado | Buscar por CRM              |

### Appointments (`/appointments`)

| Método | Rota                      | Acesso         | Descrição          |
| ------ | ------------------------- | -------------- | ------------------ |
| POST   | /appointments             | Doctor/Patient | Criar consulta     |
| GET    | /appointments             | Autenticado    | Listar consultas   |
| GET    | /appointments/:id         | Autenticado    | Consulta por ID    |
| PUT    | /appointments/:id         | Doctor/Patient | Atualizar consulta |
| POST   | /appointments/:id/respond | Patient        | Responder consulta |
| DELETE | /appointments/:id         | Doctor/Patient | Deletar consulta   |

### Medications (`/medications`)

| Método | Rota             | Acesso         | Descrição             |
| ------ | ---------------- | -------------- | --------------------- |
| POST   | /medications     | Doctor/Patient | Criar medicamento     |
| GET    | /medications     | Autenticado    | Listar medicamentos   |
| GET    | /medications/:id | Autenticado    | Medicamento por ID    |
| PUT    | /medications/:id | Doctor/Patient | Atualizar medicamento |
| DELETE | /medications/:id | Doctor/Patient | Deletar medicamento   |

### Exams (`/exams`)

| Método | Rota       | Acesso         | Descrição               |
| ------ | ---------- | -------------- | ----------------------- |
| POST   | /exams     | Doctor/Patient | Criar exame (multipart) |
| GET    | /exams     | Autenticado    | Listar exames           |
| GET    | /exams/:id | Autenticado    | Exame por ID            |
| PUT    | /exams/:id | Doctor/Patient | Atualizar exame         |
| DELETE | /exams/:id | Doctor/Patient | Deletar exame           |

### Availability

| Método | Rota                        | Acesso | Descrição                 |
| ------ | --------------------------- | ------ | ------------------------- |
| GET    | /availabilityRules          | Doctor | Regras de disponibilidade |
| PUT    | /availabilityRules/:id      | Doctor | Atualizar regra           |
| GET    | /availabilityExceptions     | Doctor | Exceções                  |
| POST   | /availabilityExceptions     | Doctor | Criar exceção             |
| DELETE | /availabilityExceptions/:id | Doctor | Remover exceção           |

### Notifications (`/notifications`)

| Método | Rota                           | Acesso      | Descrição               |
| ------ | ------------------------------ | ----------- | ----------------------- |
| POST   | /notifications/device-token    | Autenticado | Registrar push token    |
| DELETE | /notifications/device-token    | Autenticado | Remover push token      |
| GET    | /notifications/me              | Autenticado | Minhas notificações     |
| GET    | /notifications/me/unread-count | Autenticado | Contagem não lidas      |
| PATCH  | /notifications/:id/read        | Autenticado | Marcar como lida        |
| PATCH  | /notifications/read-all        | Autenticado | Marcar todas como lidas |

### Clinic Admin (`/clinic-admin`)

| Método | Rota                            | Acesso          | Descrição              |
| ------ | ------------------------------- | --------------- | ---------------------- |
| GET    | /clinic-admin/overview          | Admin           | Visão geral da clínica |
| GET    | /clinic-admin/members           | Admin           | Listar membros         |
| POST   | /clinic-admin/members           | Admin           | Adicionar membro       |
| PATCH  | /clinic-admin/members/:id/role  | Admin           | Alterar role           |
| DELETE | /clinic-admin/members/:id       | Admin           | Remover membro         |
| POST   | /clinic-admin/doctors/shadow    | Admin           | Criar médico shadow    |
| GET    | /clinic-admin/patients          | Admin/Secretary | Pacientes da clínica   |
| GET    | /clinic-admin/doctors           | Admin/Secretary | Médicos da clínica     |
| GET    | /clinic-admin/doctors/search?q= | Admin           | Buscar médicos         |

### Exam Catalog (`/exam-catalog`)

| Método | Rota                     | Acesso  | Descrição                 |
| ------ | ------------------------ | ------- | ------------------------- |
| GET    | /exam-catalog            | Público | Listar catálogo de exames |
| GET    | /exam-catalog/categories | Público | Listar categorias         |

### Exam Scheduling (`/exam-schedules`)

| Método | Rota                | Acesso  | Descrição             |
| ------ | ------------------- | ------- | --------------------- |
| POST   | /exam-schedules     | Patient | Criar agendamento     |
| GET    | /exam-schedules     | Patient | Listar agendamentos   |
| GET    | /exam-schedules/:id | Patient | Agendamento por ID    |
| PATCH  | /exam-schedules/:id | Patient | Atualizar agendamento |
| DELETE | /exam-schedules/:id | Patient | Deletar agendamento   |

---

## Regras de Negócio

### Controle de Acesso (RBAC)

- **Pacientes** podem: gerenciar dependentes, responder solicitações, revogar permissões, agendar exames
- **Médicos** podem: solicitar acesso a pacientes, criar consultas/medicamentos/exames para pacientes autorizados
- **Admins** podem: gerenciar membros da clínica, criar médicos shadow, ver pacientes da clínica
- **Secretárias** podem: ver pacientes e médicos da clínica

### Pacientes Shadow

- Criados por médicos/admins sem senha
- Recebem código de verificação por email
- Ativam conta definindo senha própria

### Permissões de Acesso

- Médico solicita → Paciente aprova/rejeita
- Aprovação cria `DoctorPermission` (isActive=true)
- Paciente pode revogar a qualquer momento
- Sem permissão ativa, médico não acessa dados do paciente

---

## Como Executar

```bash
# Instalar dependências
npm install

# Subir banco e MinIO
docker-compose -f docker-compose.dev.yml up -d

# Rodar migrations
npm run migration:run

# Popular banco com dados de teste
npm run seed:run

# Iniciar em desenvolvimento
npm run dev
```

### Credenciais de Teste (após seed)

| Tipo     | Email                         | Senha  |
| -------- | ----------------------------- | ------ |
| Médico   | doctor.seed@pocketmed.com     | 123456 |
| Médico   | fernando.luckesi.dr@gmail.com | 958969 |
| Paciente | patient.seed@pocketmed.com    | 958969 |
