-- ============================================================================
-- Script: seed-patients.sql
-- Descrição: Limpa dados existentes e cria um ambiente completo de testes:
--   - 1 Clínica (Policlínica PocketMed)
--   - 1 Médico admin (fernando.luckesi94@gmail.com / Fernando958969++)
--   - 50 Pacientes (20 com acesso liberado ao médico, 30 sem)
-- ============================================================================

-- ============================================================================
-- 1. Limpar dados existentes (ordem respeitando FKs)
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM doctor_permissions;
DELETE FROM doctor_access_requests;
DELETE FROM appointments;
DELETE FROM medications;
DELETE FROM exams;
DELETE FROM patient_access_logs;
DELETE FROM patient_diseases;
DELETE FROM patient_allergies;
DELETE FROM patient_vaccines;
DELETE FROM clinic_memberships;
DELETE FROM doctor_documents;
DELETE FROM patients;
DELETE FROM doctors;
DELETE FROM clinics;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 2. Criar Clínica
-- ============================================================================

SET @clinic_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO clinics (id, name, cnpj, isActive, cep, street, number, complement, neighborhood, city, state, noNumber, createdAt, updatedAt)
VALUES (
  @clinic_id,
  'Policlínica PocketMed',
  '56770702000109',
  1,
  '05568010',
  'Rua Severiano Leite da Silva',
  '443',
  NULL,
  'Jardim São Jorge',
  'São Paulo',
  'SP',
  0,
  NOW(),
  NOW()
);

-- ============================================================================
-- 3. Criar Médico Admin
-- ============================================================================

SET @doctor_id = '22222222-2222-2222-2222-222222222222';
SET @password_hash = '$2b$10$mxesa5f1cOwSq92gPMrP0OHQpw3w0wByXGgUjlH4GbFkVwqYBtpaW';

INSERT INTO doctors (id, name, email, password, gender, phone, birthDate, profileImage, type, isShadow, emailVerified, specialty, crm, rqe, cpf, verificationStatus, createdAt, updatedAt)
VALUES (
  @doctor_id,
  'Dr. Fernando Luckesi',
  'fernando.luckesi94@gmail.com',
  @password_hash,
  'Masculino',
  '11992486811',
  '1994-03-25',
  NULL,
  'doctor',
  0,
  1,
  'Cardiologia',
  '12345/SP',
  NULL,
  '42275937862',
  'APPROVED',
  NOW(),
  NOW()
);

-- ============================================================================
-- 4. Vincular Médico à Clínica (role: admin)
-- ============================================================================

INSERT INTO clinic_memberships (id, clinicId, professionalId, role, isActive, invitedBy, createdAt, updatedAt)
VALUES (
  UUID(),
  @clinic_id,
  @doctor_id,
  'admin',
  1,
  NULL,
  NOW(),
  NOW()
);

-- ============================================================================
-- 5. Inserir 50 Pacientes (todos criados por esse médico)
-- ============================================================================

SET @pwd_paciente = '$2b$10$mxesa5f1cOwSq92gPMrP0OHQpw3w0wByXGgUjlH4GbFkVwqYBtpaW';

INSERT INTO patients (id, name, email, password, gender, phone, birthDate, type, isShadow, emailVerified, doctorCreatorId, createdAt, updatedAt) VALUES
('aaaa0001-0001-0001-0001-000000000001', 'Maria Silva Santos', 'maria.silva@paciente.com', @pwd_paciente, 'Feminino', '11987650001', '1985-03-15', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0002-0002-0002-0002-000000000002', 'João Pedro Oliveira', 'joao.oliveira@paciente.com', @pwd_paciente, 'Masculino', '11987650002', '1990-07-22', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0003-0003-0003-0003-000000000003', 'Ana Carolina Souza', 'ana.souza@paciente.com', @pwd_paciente, 'Feminino', '11987650003', '1978-11-08', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0004-0004-0004-0004-000000000004', 'Carlos Eduardo Lima', 'carlos.lima@paciente.com', @pwd_paciente, 'Masculino', '11987650004', '1995-01-30', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0005-0005-0005-0005-000000000005', 'Fernanda Costa Alves', 'fernanda.alves@paciente.com', @pwd_paciente, 'Feminino', '11987650005', '1982-05-12', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0006-0006-0006-0006-000000000006', 'Ricardo Mendes Ferreira', 'ricardo.ferreira@paciente.com', @pwd_paciente, 'Masculino', '11987650006', '1988-09-25', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0007-0007-0007-0007-000000000007', 'Patricia Rodrigues Nunes', 'patricia.nunes@paciente.com', @pwd_paciente, 'Feminino', '11987650007', '1992-04-18', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0008-0008-0008-0008-000000000008', 'Bruno Carvalho Dias', 'bruno.dias@paciente.com', @pwd_paciente, 'Masculino', '11987650008', '1975-12-03', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0009-0009-0009-0009-000000000009', 'Camila Barbosa Martins', 'camila.martins@paciente.com', @pwd_paciente, 'Feminino', '11987650009', '1998-08-27', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0010-0010-0010-0010-000000000010', 'Diego Araujo Pereira', 'diego.pereira@paciente.com', @pwd_paciente, 'Masculino', '11987650010', '1983-06-14', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0011-0011-0011-0011-000000000011', 'Juliana Nascimento Rocha', 'juliana.rocha@paciente.com', @pwd_paciente, 'Feminino', '11987650011', '1991-02-09', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0012-0012-0012-0012-000000000012', 'Thiago Gomes Ribeiro', 'thiago.ribeiro@paciente.com', @pwd_paciente, 'Masculino', '11987650012', '1987-10-21', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0013-0013-0013-0013-000000000013', 'Larissa Fernandes Castro', 'larissa.castro@paciente.com', @pwd_paciente, 'Feminino', '11987650013', '1994-07-05', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0014-0014-0014-0014-000000000014', 'Rafael Santos Correia', 'rafael.correia@paciente.com', @pwd_paciente, 'Masculino', '11987650014', '1980-03-28', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0015-0015-0015-0015-000000000015', 'Beatriz Moreira Vieira', 'beatriz.vieira@paciente.com', @pwd_paciente, 'Feminino', '11987650015', '1996-11-16', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0016-0016-0016-0016-000000000016', 'Lucas Almeida Teixeira', 'lucas.teixeira@paciente.com', @pwd_paciente, 'Masculino', '11987650016', '1989-01-07', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0017-0017-0017-0017-000000000017', 'Gabriela Lopes Cardoso', 'gabriela.cardoso@paciente.com', @pwd_paciente, 'Feminino', '11987650017', '1977-08-23', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0018-0018-0018-0018-000000000018', 'Marcos Vinicius Pinto', 'marcos.pinto@paciente.com', @pwd_paciente, 'Masculino', '11987650018', '1993-05-11', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0019-0019-0019-0019-000000000019', 'Aline Freitas Monteiro', 'aline.monteiro@paciente.com', @pwd_paciente, 'Feminino', '11987650019', '1986-12-30', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0020-0020-0020-0020-000000000020', 'Felipe Ramos Azevedo', 'felipe.azevedo@paciente.com', @pwd_paciente, 'Masculino', '11987650020', '1999-04-02', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0021-0021-0021-0021-000000000021', 'Renata Cunha Borges', 'renata.borges@paciente.com', @pwd_paciente, 'Feminino', '11987650021', '1984-09-19', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0022-0022-0022-0022-000000000022', 'Gustavo Henrique Melo', 'gustavo.melo@paciente.com', @pwd_paciente, 'Masculino', '11987650022', '1976-06-07', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0023-0023-0023-0023-000000000023', 'Isabela Duarte Campos', 'isabela.campos@paciente.com', @pwd_paciente, 'Feminino', '11987650023', '1997-02-14', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0024-0024-0024-0024-000000000024', 'Leandro Sousa Medeiros', 'leandro.medeiros@paciente.com', @pwd_paciente, 'Masculino', '11987650024', '1981-10-26', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0025-0025-0025-0025-000000000025', 'Vanessa Pires Cavalcanti', 'vanessa.cavalcanti@paciente.com', @pwd_paciente, 'Feminino', '11987650025', '1990-07-08', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0026-0026-0026-0026-000000000026', 'Anderson Reis Figueiredo', 'anderson.figueiredo@paciente.com', @pwd_paciente, 'Masculino', '11987650026', '1974-04-17', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0027-0027-0027-0027-000000000027', 'Tatiana Moura Xavier', 'tatiana.xavier@paciente.com', @pwd_paciente, 'Feminino', '11987650027', '1993-01-23', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0028-0028-0028-0028-000000000028', 'Rodrigo Fonseca Barros', 'rodrigo.barros@paciente.com', @pwd_paciente, 'Masculino', '11987650028', '1988-08-11', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0029-0029-0029-0029-000000000029', 'Priscila Andrade Rezende', 'priscila.rezende@paciente.com', @pwd_paciente, 'Feminino', '11987650029', '1979-05-29', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0030-0030-0030-0030-000000000030', 'Eduardo Machado Sampaio', 'eduardo.sampaio@paciente.com', @pwd_paciente, 'Masculino', '11987650030', '1995-12-04', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0031-0031-0031-0031-000000000031', 'Daniela Vasconcelos Cruz', 'daniela.cruz@paciente.com', @pwd_paciente, 'Feminino', '11987650031', '1986-03-16', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0032-0032-0032-0032-000000000032', 'Henrique Batista Leal', 'henrique.leal@paciente.com', @pwd_paciente, 'Masculino', '11987650032', '1992-11-22', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0033-0033-0033-0033-000000000033', 'Luciana Tavares Brito', 'luciana.brito@paciente.com', @pwd_paciente, 'Feminino', '11987650033', '1983-07-09', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0034-0034-0034-0034-000000000034', 'Matheus Coelho Guimarães', 'matheus.guimaraes@paciente.com', @pwd_paciente, 'Masculino', '11987650034', '1997-09-01', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0035-0035-0035-0035-000000000035', 'Simone Pacheco Amaral', 'simone.amaral@paciente.com', @pwd_paciente, 'Feminino', '11987650035', '1980-02-18', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0036-0036-0036-0036-000000000036', 'Vinícius Nogueira Sales', 'vinicius.sales@paciente.com', @pwd_paciente, 'Masculino', '11987650036', '1991-06-25', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0037-0037-0037-0037-000000000037', 'Amanda Pinheiro Lacerda', 'amanda.lacerda@paciente.com', @pwd_paciente, 'Feminino', '11987650037', '1976-10-13', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0038-0038-0038-0038-000000000038', 'Pedro Henrique Siqueira', 'pedro.siqueira@paciente.com', @pwd_paciente, 'Masculino', '11987650038', '1994-04-07', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0039-0039-0039-0039-000000000039', 'Raquel Aguiar Coutinho', 'raquel.coutinho@paciente.com', @pwd_paciente, 'Feminino', '11987650039', '1987-01-20', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0040-0040-0040-0040-000000000040', 'Fábio Cardoso Miranda', 'fabio.miranda@paciente.com', @pwd_paciente, 'Masculino', '11987650040', '1982-08-06', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0041-0041-0041-0041-000000000041', 'Cristiane Magalhães Assis', 'cristiane.assis@paciente.com', @pwd_paciente, 'Feminino', '11987650041', '1996-05-31', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0042-0042-0042-0042-000000000042', 'Alexandre Bastos Alencar', 'alexandre.alencar@paciente.com', @pwd_paciente, 'Masculino', '11987650042', '1979-12-15', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0043-0043-0043-0043-000000000043', 'Elisa Queiroz Faria', 'elisa.faria@paciente.com', @pwd_paciente, 'Feminino', '11987650043', '1993-03-24', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0044-0044-0044-0044-000000000044', 'Roberto Silveira Lopes', 'roberto.lopes@paciente.com', @pwd_paciente, 'Masculino', '11987650044', '1985-11-08', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0045-0045-0045-0045-000000000045', 'Michele Torres Rangel', 'michele.rangel@paciente.com', @pwd_paciente, 'Feminino', '11987650045', '1990-06-19', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0046-0046-0046-0046-000000000046', 'Caio Domingues Vargas', 'caio.vargas@paciente.com', @pwd_paciente, 'Masculino', '11987650046', '1977-09-02', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0047-0047-0047-0047-000000000047', 'Mariana Esteves Paiva', 'mariana.paiva@paciente.com', @pwd_paciente, 'Feminino', '11987650047', '1998-01-28', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0048-0048-0048-0048-000000000048', 'Wagner Bezerra Trindade', 'wagner.trindade@paciente.com', @pwd_paciente, 'Masculino', '11987650048', '1984-07-14', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0049-0049-0049-0049-000000000049', 'Sabrina Matos Serrano', 'sabrina.serrano@paciente.com', @pwd_paciente, 'Feminino', '11987650049', '1989-04-06', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
('aaaa0050-0050-0050-0050-000000000050', 'Leonardo Braga Fontenele', 'leonardo.fontenele@paciente.com', @pwd_paciente, 'Masculino', '11987650050', '1981-10-20', 'patient', 0, 1, @doctor_id, NOW(), NOW());

-- ============================================================================
-- 6. Conceder permissão de acesso ao médico para os primeiros 20 pacientes
--    (esses são os "pacientes ativos" com acesso liberado)
-- ============================================================================

INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doctor_id, 'aaaa0001-0001-0001-0001-000000000001', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0002-0002-0002-0002-000000000002', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0003-0003-0003-0003-000000000003', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0004-0004-0004-0004-000000000004', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0005-0005-0005-0005-000000000005', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0006-0006-0006-0006-000000000006', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0007-0007-0007-0007-000000000007', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0008-0008-0008-0008-000000000008', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0009-0009-0009-0009-000000000009', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0010-0010-0010-0010-000000000010', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0011-0011-0011-0011-000000000011', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0012-0012-0012-0012-000000000012', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0013-0013-0013-0013-000000000013', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0014-0014-0014-0014-000000000014', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0015-0015-0015-0015-000000000015', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0016-0016-0016-0016-000000000016', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0017-0017-0017-0017-000000000017', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0018-0018-0018-0018-000000000018', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0019-0019-0019-0019-000000000019', 1, NOW()),
(UUID(), @doctor_id, 'aaaa0020-0020-0020-0020-000000000020', 1, NOW());

-- ============================================================================
-- 7. Verificação
-- ============================================================================

SELECT 'Clínica criada:' AS info, id, name FROM clinics;
SELECT 'Médico criado:' AS info, id, name, email FROM doctors;
SELECT COUNT(*) AS total_pacientes FROM patients;
SELECT COUNT(*) AS pacientes_com_acesso FROM doctor_permissions WHERE doctorId = @doctor_id AND isActive = 1;
SELECT COUNT(*) AS memberships FROM clinic_memberships WHERE clinicId = @clinic_id;
