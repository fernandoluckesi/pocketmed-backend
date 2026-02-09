# Exemplos de Requisições - PocketMed API

## Autenticação

### 1. Registrar Paciente
```bash
curl -X POST http://localhost:3000/auth/register/patient \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@email.com",
    "password": "senha123",
    "gender": "Feminino",
    "phone": "(11) 98888-1234",
    "birthDate": "1990-05-15"
  }'
```

### 2. Registrar Médico
```bash
curl -X POST http://localhost:3000/auth/register/doctor \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. João Santos",
    "email": "dr.joao@email.com",
    "password": "senha123",
    "gender": "Masculino",
    "specialty": "Cardiologia",
    "cpf": "12345678901",
    "phone": "(11) 97777-1234",
    "birthDate": "1980-03-10",
    "crm": "123456/SP"
  }'
```

### 3. Registrar Paciente Shadow
```bash
curl -X POST http://localhost:3000/auth/register/patient-shadow \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pedro Costa Shadow",
    "email": "pedro@email.com",
    "gender": "Masculino",
    "phone": "(11) 96666-1234",
    "birthDate": "1975-08-20",
    "doctorCreatorId": "<doctor_id>"
  }'
```

### 4. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria@email.com",
    "password": "senha123"
  }'
```

### 5. Enviar Código de Verificação
```bash
curl -X POST http://localhost:3000/auth/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pedro@email.com"
  }'
```

### 6. Ativar Conta Shadow
```bash
curl -X POST http://localhost:3000/auth/activate-shadow-account \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pedro@email.com",
    "verificationCode": "123456",
    "password": "senha123"
  }'
```

### 7. Esqueci a Senha
```bash
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria@email.com"
  }'
```

### 8. Resetar Senha
```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria@email.com",
    "resetCode": "123456",
    "newPassword": "novasenha123"
  }'
```

### 9. Alterar Senha (autenticado)
```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "oldPassword": "senha123",
    "newPassword": "novasenha123"
  }'
```

## Pacientes

### 1. Listar Todos Pacientes (apenas médicos)
```bash
curl -X GET http://localhost:3000/patients \
  -H "Authorization: Bearer <doctor_token>"
```

### 2. Buscar Paciente por ID
```bash
curl -X GET http://localhost:3000/patients/<patient_id> \
  -H "Authorization: Bearer <token>"
```

### 3. Buscar Pacientes (mínimo 3 caracteres)
```bash
curl -X GET "http://localhost:3000/patients/search?q=Maria" \
  -H "Authorization: Bearer <doctor_token>"
```

## Dependentes

### 1. Criar Dependente
```bash
curl -X POST http://localhost:3000/dependents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <patient_token>" \
  -d '{
    "name": "Lucas Silva",
    "gender": "Masculino",
    "type": "Filho",
    "birthDate": "2010-06-15"
  }'
```

### 2. Listar Dependentes
```bash
curl -X GET http://localhost:3000/dependents \
  -H "Authorization: Bearer <patient_token>"
```

### 3. Buscar Dependente por ID
```bash
curl -X GET http://localhost:3000/dependents/<dependent_id> \
  -H "Authorization: Bearer <patient_token>"
```

### 4. Adicionar Responsável
```bash
curl -X POST http://localhost:3000/dependents/<dependent_id>/add-responsible \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <patient_token>" \
  -d '{
    "patientId": "<another_patient_id>"
  }'
```

### 5. Deletar Dependente
```bash
curl -X DELETE http://localhost:3000/dependents/<dependent_id> \
  -H "Authorization: Bearer <patient_token>"
```

## Médicos

### 1. Listar Todos Médicos
```bash
curl -X GET http://localhost:3000/doctors \
  -H "Authorization: Bearer <token>"
```

### 2. Buscar Médico por ID
```bash
curl -X GET http://localhost:3000/doctors/<doctor_id> \
  -H "Authorization: Bearer <token>"
```

### 3. Solicitar Acesso a Paciente
```bash
curl -X POST http://localhost:3000/doctors/request-access \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{
    "patientId": "<patient_id>",
    "message": "Gostaria de acessar seu histórico médico para consulta"
  }'
```

### 4. Solicitar Acesso a Dependente
```bash
curl -X POST http://localhost:3000/doctors/request-access \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{
    "dependentId": "<dependent_id>",
    "message": "Gostaria de acessar o histórico médico do dependente"
  }'
```

### 5. Minhas Solicitações (médico)
```bash
curl -X GET http://localhost:3000/doctors/access-requests/me \
  -H "Authorization: Bearer <doctor_token>"
```

### 6. Solicitações Para Mim (paciente)
```bash
curl -X GET http://localhost:3000/doctors/access-requests/patient/me \
  -H "Authorization: Bearer <patient_token>"
```

### 7. Solicitações Para Meus Dependentes (paciente)
```bash
curl -X GET http://localhost:3000/doctors/access-requests/dependents/me \
  -H "Authorization: Bearer <patient_token>"
```

### 8. Responder Solicitação
```bash
curl -X POST http://localhost:3000/doctors/access-requests/<request_id>/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <patient_token>" \
  -d '{
    "status": "approved"
  }'
```

## Consultas

### 1. Criar Consulta
```bash
curl -X POST http://localhost:3000/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{
    "doctorCrm": "123456/SP",
    "doctorName": "Dr. João Santos",
    "doctorSpecialty": "Cardiologia",
    "reason": "Consulta de rotina",
    "dateTime": "2024-03-15T14:30:00Z",
    "patientId": "<patient_id>"
  }'
```

### 2. Listar Consultas
```bash
curl -X GET http://localhost:3000/appointments \
  -H "Authorization: Bearer <token>"
```

### 3. Buscar Consulta por ID
```bash
curl -X GET http://localhost:3000/appointments/<appointment_id> \
  -H "Authorization: Bearer <token>"
```

### 4. Atualizar Consulta
```bash
curl -X PUT http://localhost:3000/appointments/<appointment_id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{
    "isCompleted": true,
    "doctorFeedback": "Paciente apresenta boa evolução",
    "doctorInstructions": "Continuar com medicação atual"
  }'
```

### 5. Responder Consulta (paciente)
```bash
curl -X POST http://localhost:3000/appointments/<appointment_id>/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <patient_token>" \
  -d '{
    "status": "approved"
  }'
```

### 6. Deletar Consulta
```bash
curl -X DELETE http://localhost:3000/appointments/<appointment_id> \
  -H "Authorization: Bearer <doctor_token>"
```

## Medicamentos

### 1. Criar Medicamento
```bash
curl -X POST http://localhost:3000/medications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{
    "name": "Losartana",
    "dosage": "50mg",
    "frequency": "once_daily",
    "times": ["08:00"],
    "startDate": "2024-02-01",
    "endDate": "2024-08-01",
    "duration": 180,
    "instructions": "Tomar em jejum",
    "isActive": true,
    "patientId": "<patient_id>"
  }'
```

### 2. Listar Medicamentos
```bash
curl -X GET http://localhost:3000/medications \
  -H "Authorization: Bearer <token>"
```

### 3. Buscar Medicamento por ID
```bash
curl -X GET http://localhost:3000/medications/<medication_id> \
  -H "Authorization: Bearer <token>"
```

### 4. Atualizar Medicamento
```bash
curl -X PUT http://localhost:3000/medications/<medication_id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{
    "dosage": "100mg",
    "isActive": false,
    "isFinished": true
  }'
```

### 5. Deletar Medicamento
```bash
curl -X DELETE http://localhost:3000/medications/<medication_id> \
  -H "Authorization: Bearer <doctor_token>"
```

## Exames

### 1. Criar Exame
```bash
curl -X POST http://localhost:3000/exams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{
    "name": "Hemograma Completo",
    "type": "blood_test",
    "description": "Exame de sangue completo",
    "scheduledDate": "2024-03-20",
    "status": "scheduled",
    "laboratory": "Laboratório São Lucas",
    "patientId": "<patient_id>"
  }'
```

### 2. Listar Exames
```bash
curl -X GET http://localhost:3000/exams \
  -H "Authorization: Bearer <token>"
```

### 3. Buscar Exame por ID
```bash
curl -X GET http://localhost:3000/exams/<exam_id> \
  -H "Authorization: Bearer <token>"
```

### 4. Atualizar Exame
```bash
curl -X PUT http://localhost:3000/exams/<exam_id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{
    "status": "completed",
    "results": "Resultados normais",
    "observations": "Paciente estava em jejum"
  }'
```

### 5. Deletar Exame
```bash
curl -X DELETE http://localhost:3000/exams/<exam_id> \
  -H "Authorization: Bearer <doctor_token>"
```

## Upload de Arquivos

### Com Imagem de Perfil (Multipart)
```bash
curl -X POST http://localhost:3000/auth/register/patient \
  -H "Authorization: Bearer <token>" \
  -F "name=Maria Silva" \
  -F "email=maria@email.com" \
  -F "password=senha123" \
  -F "gender=Feminino" \
  -F "phone=(11) 98888-1234" \
  -F "birthDate=1990-05-15" \
  -F "profileImage=@/path/to/image.jpg"
```

### Com Arquivo de Resultado de Exame
```bash
curl -X POST http://localhost:3000/exams \
  -H "Authorization: Bearer <doctor_token>" \
  -F "name=Raio-X Tórax" \
  -F "type=xray" \
  -F "patientId=<patient_id>" \
  -F "resultFile=@/path/to/result.pdf"
```

## Fluxo Completo de Exemplo

### 1. Médico cria conta
```bash
curl -X POST http://localhost:3000/auth/register/doctor \
  -H "Content-Type: application/json" \
  -d '{"name":"Dr. João","email":"dr.joao@email.com","password":"senha123","gender":"Masculino","specialty":"Cardiologia","cpf":"12345678901","phone":"(11) 97777-1234","birthDate":"1980-03-10","crm":"123456/SP"}'
```

### 2. Médico faz login e recebe token
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.joao@email.com","password":"senha123"}'
# Retorna: {"user":{...},"token":"<doctor_token>"}
```

### 3. Médico cria paciente shadow
```bash
curl -X POST http://localhost:3000/auth/register/patient-shadow \
  -H "Content-Type: application/json" \
  -d '{"name":"Pedro Costa","email":"pedro@email.com","gender":"Masculino","phone":"(11) 96666-1234","birthDate":"1975-08-20","doctorCreatorId":"<doctor_id>"}'
```

### 4. Paciente ativa conta
```bash
curl -X POST http://localhost:3000/auth/activate-shadow-account \
  -H "Content-Type: application/json" \
  -d '{"email":"pedro@email.com","verificationCode":"123456","password":"senha123"}'
```

### 5. Médico solicita acesso
```bash
curl -X POST http://localhost:3000/doctors/request-access \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{"patientId":"<patient_id>","message":"Gostaria de acessar seu histórico"}'
```

### 6. Paciente aprova acesso
```bash
curl -X POST http://localhost:3000/doctors/access-requests/<request_id>/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <patient_token>" \
  -d '{"status":"approved"}'
```

### 7. Médico cria consulta
```bash
curl -X POST http://localhost:3000/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{"doctorCrm":"123456/SP","doctorName":"Dr. João","doctorSpecialty":"Cardiologia","reason":"Consulta de rotina","dateTime":"2024-03-15T14:30:00Z","patientId":"<patient_id>"}'
```

### 8. Médico adiciona medicamento
```bash
curl -X POST http://localhost:3000/medications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{"name":"Losartana","dosage":"50mg","frequency":"once_daily","times":["08:00"],"startDate":"2024-02-01","patientId":"<patient_id>"}'
```

### 9. Médico solicita exame
```bash
curl -X POST http://localhost:3000/exams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <doctor_token>" \
  -d '{"name":"Hemograma","type":"blood_test","scheduledDate":"2024-03-20","patientId":"<patient_id>"}'
```

## Testes com Postman/Insomnia

Importe os exemplos acima ou use a documentação Swagger em:
```
http://localhost:3000/api/docs
```
