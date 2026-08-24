-- ============================================================================
-- Script: seed-local.sql
-- Descrição: Seed completo para ambiente local.
--   - Limpa TUDO
--   - Cria 1 clínica (Policlínica)
--   - Cria 1 médico admin (Hipócrates - hipocrates@email.com / Fernando958969++)
--   - Cria 10 médicos membros da clínica (cada um com 10 pacientes com acesso)
--   - O admin Hipócrates tem acesso a 20 pacientes
--   - Total: 150+ pacientes na plataforma
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Limpar tudo
DELETE FROM doctor_permissions;
DELETE FROM doctor_access_requests;
DELETE FROM appointments;
DELETE FROM medications;
DELETE FROM exams;
DELETE FROM exam_schedules;
DELETE FROM exam_schedule_items;
DELETE FROM clinic_memberships;
DELETE FROM secretary_profiles;
DELETE FROM clinic_admin_profiles;
DELETE FROM dependents;
DELETE FROM patients;
DELETE FROM doctors;
DELETE FROM clinics;
DELETE FROM notifications;
DELETE FROM device_tokens;
DELETE FROM patient_access_logs;
DELETE FROM patient_diseases;
DELETE FROM patient_allergies;
DELETE FROM patient_vaccines;
DELETE FROM doctor_documents;
DELETE FROM financial_settings;
DELETE FROM financial_cost_centers;
DELETE FROM financial_convenios;
DELETE FROM financial_revenues;
DELETE FROM financial_expenses;
DELETE FROM financial_doctor_transfers;
DELETE FROM financial_cashflow_entries;
DELETE FROM audit_events;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Senha: Fernando958969++ (bcrypt hash)
-- ============================================================================
SET @pw = '$2b$10$mxesa5f1cOwSq92gPMrP0OHQpw3w0wByXGgUjlH4GbFkVwqYBtpaW';

-- ============================================================================
-- 1. CLÍNICA
-- ============================================================================
SET @clinic_id = 'c0000000-0000-4000-a000-000000000001';

INSERT INTO clinics (id, name, cnpj, isActive, cep, street, number, complement, neighborhood, city, state, noNumber, createdAt, updatedAt)
VALUES (@clinic_id, 'Policlínica', '12345678000199', 1, '01310-100', 'Av. Paulista', '1000', 'Conjunto 501', 'Bela Vista', 'São Paulo', 'SP', 0, NOW(), NOW());

-- ============================================================================
-- 2. MÉDICO ADMIN (Hipócrates)
-- ============================================================================
SET @doc_admin = 'd0000000-0000-4000-a000-000000000001';

INSERT INTO doctors (id, name, email, password, gender, phone, birthDate, type, isShadow, emailVerified, specialty, crm, cpf, verificationStatus, createdAt, updatedAt)
VALUES (@doc_admin, 'Dr. Hipócrates Medeiros', 'hipocrates@email.com', @pw, 'Masculino', '11999000001', '1980-06-15', 'doctor', 0, 1, 'Clínica Geral', '100001/SP', '10000000001', 'APPROVED', NOW(), NOW());

INSERT INTO clinic_memberships (id, clinicId, professionalId, role, isActive, createdAt, updatedAt)
VALUES (UUID(), @clinic_id, @doc_admin, 'admin', 1, NOW(), NOW());

-- ============================================================================
-- 3. 10 MÉDICOS DA CLÍNICA
-- ============================================================================
SET @doc01 = 'd0000000-0000-4000-a000-000000000101';
SET @doc02 = 'd0000000-0000-4000-a000-000000000102';
SET @doc03 = 'd0000000-0000-4000-a000-000000000103';
SET @doc04 = 'd0000000-0000-4000-a000-000000000104';
SET @doc05 = 'd0000000-0000-4000-a000-000000000105';
SET @doc06 = 'd0000000-0000-4000-a000-000000000106';
SET @doc07 = 'd0000000-0000-4000-a000-000000000107';
SET @doc08 = 'd0000000-0000-4000-a000-000000000108';
SET @doc09 = 'd0000000-0000-4000-a000-000000000109';
SET @doc10 = 'd0000000-0000-4000-a000-000000000110';

INSERT INTO doctors (id, name, email, password, gender, phone, birthDate, type, isShadow, emailVerified, specialty, crm, cpf, verificationStatus, createdAt, updatedAt) VALUES
(@doc01, 'Dra. Camila Ferreira', 'camila.ferreira@email.com', @pw, 'Feminino', '11999000101', '1985-03-12', 'doctor', 0, 1, 'Cardiologia', '200001/SP', '20000000001', 'APPROVED', NOW(), NOW()),
(@doc02, 'Dr. Rafael Souza', 'rafael.souza@email.com', @pw, 'Masculino', '11999000102', '1982-07-25', 'doctor', 0, 1, 'Dermatologia', '200002/SP', '20000000002', 'APPROVED', NOW(), NOW()),
(@doc03, 'Dra. Juliana Martins', 'juliana.martins@email.com', @pw, 'Feminino', '11999000103', '1990-01-08', 'doctor', 0, 1, 'Pediatria', '200003/SP', '20000000003', 'APPROVED', NOW(), NOW()),
(@doc04, 'Dr. Bruno Oliveira', 'bruno.oliveira@email.com', @pw, 'Masculino', '11999000104', '1978-11-30', 'doctor', 0, 1, 'Ortopedia e Traumatologia', '200004/SP', '20000000004', 'APPROVED', NOW(), NOW()),
(@doc05, 'Dra. Fernanda Lima', 'fernanda.lima@email.com', @pw, 'Feminino', '11999000105', '1987-09-14', 'doctor', 0, 1, 'Ginecologia e Obstetrícia', '200005/SP', '20000000005', 'APPROVED', NOW(), NOW()),
(@doc06, 'Dr. Marcos Almeida', 'marcos.almeida@email.com', @pw, 'Masculino', '11999000106', '1983-04-22', 'doctor', 0, 1, 'Neurologia', '200006/SP', '20000000006', 'APPROVED', NOW(), NOW()),
(@doc07, 'Dra. Patrícia Rocha', 'patricia.rocha@email.com', @pw, 'Feminino', '11999000107', '1991-12-05', 'doctor', 0, 1, 'Endocrinologia e Metabologia', '200007/SP', '20000000007', 'APPROVED', NOW(), NOW()),
(@doc08, 'Dr. Diego Nascimento', 'diego.nascimento@email.com', @pw, 'Masculino', '11999000108', '1986-08-18', 'doctor', 0, 1, 'Pneumologia', '200008/SP', '20000000008', 'APPROVED', NOW(), NOW()),
(@doc09, 'Dra. Larissa Teixeira', 'larissa.teixeira@email.com', @pw, 'Feminino', '11999000109', '1989-05-27', 'doctor', 0, 1, 'Psiquiatria', '200009/SP', '20000000009', 'APPROVED', NOW(), NOW()),
(@doc10, 'Dr. Thiago Costa', 'thiago.costa@email.com', @pw, 'Masculino', '11999000110', '1984-02-10', 'doctor', 0, 1, 'Urologia', '200010/SP', '20000000010', 'APPROVED', NOW(), NOW());

-- Memberships (todos como doctor na clínica)
INSERT INTO clinic_memberships (id, clinicId, professionalId, role, isActive, createdAt, updatedAt) VALUES
(UUID(), @clinic_id, @doc01, 'doctor', 1, NOW(), NOW()),
(UUID(), @clinic_id, @doc02, 'doctor', 1, NOW(), NOW()),
(UUID(), @clinic_id, @doc03, 'doctor', 1, NOW(), NOW()),
(UUID(), @clinic_id, @doc04, 'doctor', 1, NOW(), NOW()),
(UUID(), @clinic_id, @doc05, 'doctor', 1, NOW(), NOW()),
(UUID(), @clinic_id, @doc06, 'doctor', 1, NOW(), NOW()),
(UUID(), @clinic_id, @doc07, 'doctor', 1, NOW(), NOW()),
(UUID(), @clinic_id, @doc08, 'doctor', 1, NOW(), NOW()),
(UUID(), @clinic_id, @doc09, 'doctor', 1, NOW(), NOW()),
(UUID(), @clinic_id, @doc10, 'doctor', 1, NOW(), NOW());

-- ============================================================================
-- 4. 160 PACIENTES
-- ============================================================================
INSERT INTO patients (id, name, email, password, gender, phone, birthDate, type, isShadow, emailVerified, doctorCreatorId, createdAt, updatedAt) VALUES
('p0000000-0000-4000-a000-000000000001', 'Maria Silva Santos', 'maria.silva@email.com', @pw, 'Feminino', '11987650001', '1985-03-15', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000002', 'João Pedro Oliveira', 'joao.oliveira@email.com', @pw, 'Masculino', '11987650002', '1990-07-22', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000003', 'Ana Carolina Souza', 'ana.souza@email.com', @pw, 'Feminino', '11987650003', '1978-11-08', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000004', 'Carlos Eduardo Lima', 'carlos.lima@email.com', @pw, 'Masculino', '11987650004', '1995-01-30', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000005', 'Fernanda Costa Alves', 'fernanda.alves@email.com', @pw, 'Feminino', '11987650005', '1982-05-12', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000006', 'Ricardo Mendes Ferreira', 'ricardo.ferreira@email.com', @pw, 'Masculino', '11987650006', '1988-09-25', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000007', 'Patrícia Rodrigues Nunes', 'patricia.nunes@email.com', @pw, 'Feminino', '11987650007', '1992-04-18', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000008', 'Bruno Carvalho Dias', 'bruno.dias@email.com', @pw, 'Masculino', '11987650008', '1975-12-03', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000009', 'Camila Barbosa Martins', 'camila.martins@email.com', @pw, 'Feminino', '11987650009', '1998-08-27', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000010', 'Diego Araújo Pereira', 'diego.pereira@email.com', @pw, 'Masculino', '11987650010', '1983-06-14', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000011', 'Juliana Nascimento Rocha', 'juliana.rocha@email.com', @pw, 'Feminino', '11987650011', '1991-02-09', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000012', 'Thiago Gomes Ribeiro', 'thiago.ribeiro@email.com', @pw, 'Masculino', '11987650012', '1987-10-21', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000013', 'Larissa Fernandes Castro', 'larissa.castro@email.com', @pw, 'Feminino', '11987650013', '1994-07-05', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000014', 'Rafael Santos Correia', 'rafael.correia@email.com', @pw, 'Masculino', '11987650014', '1980-03-28', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000015', 'Beatriz Moreira Vieira', 'beatriz.vieira@email.com', @pw, 'Feminino', '11987650015', '1996-11-16', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000016', 'Lucas Almeida Teixeira', 'lucas.teixeira@email.com', @pw, 'Masculino', '11987650016', '1989-01-07', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000017', 'Gabriela Lopes Cardoso', 'gabriela.cardoso@email.com', @pw, 'Feminino', '11987650017', '1977-08-23', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000018', 'Marcos Vinícius Pinto', 'marcos.pinto@email.com', @pw, 'Masculino', '11987650018', '1993-05-11', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000019', 'Aline Freitas Monteiro', 'aline.monteiro@email.com', @pw, 'Feminino', '11987650019', '1986-12-30', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000020', 'Felipe Ramos Azevedo', 'felipe.azevedo@email.com', @pw, 'Masculino', '11987650020', '1999-04-02', 'patient', 0, 1, @doc_admin, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000021', 'Renata Cunha Borges', 'renata.borges@email.com', @pw, 'Feminino', '11987650021', '1984-09-19', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000022', 'Gustavo Henrique Melo', 'gustavo.melo@email.com', @pw, 'Masculino', '11987650022', '1976-06-07', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000023', 'Isabela Duarte Campos', 'isabela.campos@email.com', @pw, 'Feminino', '11987650023', '1997-02-14', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000024', 'Leandro Sousa Medeiros', 'leandro.medeiros@email.com', @pw, 'Masculino', '11987650024', '1981-10-26', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000025', 'Vanessa Pires Cavalcanti', 'vanessa.cavalcanti@email.com', @pw, 'Feminino', '11987650025', '1990-07-08', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000026', 'Anderson Reis Figueiredo', 'anderson.figueiredo@email.com', @pw, 'Masculino', '11987650026', '1974-04-17', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000027', 'Tatiana Moura Xavier', 'tatiana.xavier@email.com', @pw, 'Feminino', '11987650027', '1993-01-23', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000028', 'Rodrigo Fonseca Barros', 'rodrigo.barros@email.com', @pw, 'Masculino', '11987650028', '1988-08-11', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000029', 'Priscila Andrade Rezende', 'priscila.rezende@email.com', @pw, 'Feminino', '11987650029', '1979-05-29', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000030', 'Eduardo Machado Sampaio', 'eduardo.sampaio@email.com', @pw, 'Masculino', '11987650030', '1995-12-04', 'patient', 0, 1, @doc01, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000031', 'Daniela Vasconcelos Cruz', 'daniela.cruz@email.com', @pw, 'Feminino', '11987650031', '1986-03-16', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000032', 'Henrique Batista Leal', 'henrique.leal@email.com', @pw, 'Masculino', '11987650032', '1992-11-22', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000033', 'Luciana Tavares Brito', 'luciana.brito@email.com', @pw, 'Feminino', '11987650033', '1983-07-09', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000034', 'Matheus Coelho Guimarães', 'matheus.guimaraes@email.com', @pw, 'Masculino', '11987650034', '1997-09-01', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000035', 'Simone Pacheco Amaral', 'simone.amaral@email.com', @pw, 'Feminino', '11987650035', '1980-02-18', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000036', 'Vinícius Nogueira Sales', 'vinicius.sales@email.com', @pw, 'Masculino', '11987650036', '1991-06-25', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000037', 'Amanda Pinheiro Lacerda', 'amanda.lacerda@email.com', @pw, 'Feminino', '11987650037', '1976-10-13', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000038', 'Pedro Henrique Siqueira', 'pedro.siqueira@email.com', @pw, 'Masculino', '11987650038', '1994-04-07', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000039', 'Raquel Aguiar Coutinho', 'raquel.coutinho@email.com', @pw, 'Feminino', '11987650039', '1987-01-20', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000040', 'Fábio Cardoso Miranda', 'fabio.miranda@email.com', @pw, 'Masculino', '11987650040', '1982-08-06', 'patient', 0, 1, @doc02, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000041', 'Cristiane Magalhães Assis', 'cristiane.assis@email.com', @pw, 'Feminino', '11987650041', '1996-05-31', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000042', 'Alexandre Bastos Alencar', 'alexandre.alencar@email.com', @pw, 'Masculino', '11987650042', '1979-12-15', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000043', 'Elisa Queiroz Faria', 'elisa.faria@email.com', @pw, 'Feminino', '11987650043', '1993-03-24', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000044', 'Roberto Silveira Lopes', 'roberto.lopes@email.com', @pw, 'Masculino', '11987650044', '1985-11-08', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000045', 'Michele Torres Rangel', 'michele.rangel@email.com', @pw, 'Feminino', '11987650045', '1990-06-19', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000046', 'Caio Domingues Vargas', 'caio.vargas@email.com', @pw, 'Masculino', '11987650046', '1977-09-02', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000047', 'Mariana Esteves Paiva', 'mariana.paiva@email.com', @pw, 'Feminino', '11987650047', '1998-01-28', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000048', 'Wagner Bezerra Trindade', 'wagner.trindade@email.com', @pw, 'Masculino', '11987650048', '1984-07-14', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000049', 'Sabrina Matos Serrano', 'sabrina.serrano@email.com', @pw, 'Feminino', '11987650049', '1989-04-06', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000050', 'Leonardo Braga Fontenele', 'leonardo.fontenele@email.com', @pw, 'Masculino', '11987650050', '1981-10-20', 'patient', 0, 1, @doc03, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000051', 'Adriana Mendonça Pereira', 'adriana.pereira@email.com', @pw, 'Feminino', '11987650051', '1988-02-14', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000052', 'Sérgio Lemos Andrade', 'sergio.andrade@email.com', @pw, 'Masculino', '11987650052', '1975-08-30', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000053', 'Mônica Farias Campos', 'monica.campos@email.com', @pw, 'Feminino', '11987650053', '1994-05-17', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000054', 'Antônio Gomes Pereira', 'antonio.pereira@email.com', @pw, 'Masculino', '11987650054', '1972-12-08', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000055', 'Cláudia Ribas Neves', 'claudia.neves@email.com', @pw, 'Feminino', '11987650055', '1986-09-21', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000056', 'Paulo César Moraes', 'paulo.moraes@email.com', @pw, 'Masculino', '11987650056', '1991-03-04', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000057', 'Débora Lins Cordeiro', 'debora.cordeiro@email.com', @pw, 'Feminino', '11987650057', '1983-07-26', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000058', 'Otávio Rangel Machado', 'otavio.machado@email.com', @pw, 'Masculino', '11987650058', '1996-11-12', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000059', 'Lúcia Helena Dutra', 'lucia.dutra@email.com', @pw, 'Feminino', '11987650059', '1978-04-09', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000060', 'Rogério Dantas Fonseca', 'rogerio.fonseca@email.com', @pw, 'Masculino', '11987650060', '1987-01-15', 'patient', 0, 1, @doc04, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000061', 'Sandra Maia Bezerra', 'sandra.bezerra@email.com', @pw, 'Feminino', '11987650061', '1992-06-28', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000062', 'Márcio Leal Araújo', 'marcio.araujo@email.com', @pw, 'Masculino', '11987650062', '1980-10-03', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000063', 'Viviane Borges Prado', 'viviane.prado@email.com', @pw, 'Feminino', '11987650063', '1995-08-19', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000064', 'Júlio César Queiroz', 'julio.queiroz@email.com', @pw, 'Masculino', '11987650064', '1974-03-11', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000065', 'Carla Rezende Vieira', 'carla.vieira@email.com', @pw, 'Feminino', '11987650065', '1989-12-07', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000066', 'Nilton Braga Pacheco', 'nilton.pacheco@email.com', @pw, 'Masculino', '11987650066', '1981-05-23', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000067', 'Regina Lacerda Campos', 'regina.campos@email.com', @pw, 'Feminino', '11987650067', '1993-09-16', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000068', 'Flávio Santana Nogueira', 'flavio.nogueira@email.com', @pw, 'Masculino', '11987650068', '1976-02-28', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000069', 'Valéria Costa Pinto', 'valeria.pinto@email.com', @pw, 'Feminino', '11987650069', '1997-07-05', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000070', 'Hugo Bastos Alencar', 'hugo.alencar@email.com', @pw, 'Masculino', '11987650070', '1984-11-18', 'patient', 0, 1, @doc05, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000071', 'Denise Fontes Tavares', 'denise.tavares@email.com', @pw, 'Feminino', '11987650071', '1990-04-22', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000072', 'Reginaldo Cruz Moreira', 'reginaldo.moreira@email.com', @pw, 'Masculino', '11987650072', '1979-08-09', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000073', 'Elaine Brito Sampaio', 'elaine.sampaio@email.com', @pw, 'Feminino', '11987650073', '1994-01-31', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000074', 'Nelson Martins Souza', 'nelson.souza@email.com', @pw, 'Masculino', '11987650074', '1973-06-14', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000075', 'Rosana Duarte Alves', 'rosana.alves@email.com', @pw, 'Feminino', '11987650075', '1988-10-27', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000076', 'Geraldo Teixeira Lins', 'geraldo.lins@email.com', @pw, 'Masculino', '11987650076', '1982-03-05', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000077', 'Sônia Barros Faria', 'sonia.faria@email.com', @pw, 'Feminino', '11987650077', '1996-12-20', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000078', 'Cássio Monteiro Lima', 'cassio.lima@email.com', @pw, 'Masculino', '11987650078', '1985-07-13', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000079', 'Tereza Gomes Rocha', 'tereza.rocha@email.com', @pw, 'Feminino', '11987650079', '1977-09-08', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000080', 'Ronaldo Pires Medeiros', 'ronaldo.medeiros@email.com', @pw, 'Masculino', '11987650080', '1991-05-01', 'patient', 0, 1, @doc06, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000081', 'Helena Cardoso Neves', 'helena.neves@email.com', @pw, 'Feminino', '11987650081', '1983-02-17', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000082', 'Edson Cavalcanti Reis', 'edson.reis@email.com', @pw, 'Masculino', '11987650082', '1978-11-25', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000083', 'Luciene Andrade Melo', 'luciene.melo@email.com', @pw, 'Feminino', '11987650083', '1995-06-10', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000084', 'Valdir Correia Santos', 'valdir.santos@email.com', @pw, 'Masculino', '11987650084', '1970-04-03', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000085', 'Márcia Dantas Pinheiro', 'marcia.pinheiro@email.com', @pw, 'Feminino', '11987650085', '1992-08-29', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000086', 'Cléber Fonseca Moura', 'cleber.moura@email.com', @pw, 'Masculino', '11987650086', '1986-01-16', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000087', 'Joice Almeida Trindade', 'joice.trindade@email.com', @pw, 'Feminino', '11987650087', '1998-10-08', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000088', 'Raimundo Costa Dias', 'raimundo.dias@email.com', @pw, 'Masculino', '11987650088', '1975-03-22', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000089', 'Célia Ribeiro Xavier', 'celia.xavier@email.com', @pw, 'Feminino', '11987650089', '1989-12-14', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000090', 'Jorge Nascimento Barros', 'jorge.barros@email.com', @pw, 'Masculino', '11987650090', '1981-07-07', 'patient', 0, 1, @doc07, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000091', 'Shirley Vasconcelos Lima', 'shirley.lima@email.com', @pw, 'Feminino', '11987650091', '1993-04-19', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000092', 'Wander Guimarães Pinto', 'wander.pinto@email.com', @pw, 'Masculino', '11987650092', '1980-09-26', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000093', 'Naiara Coelho Ferreira', 'naiara.ferreira@email.com', @pw, 'Feminino', '11987650093', '1997-01-12', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000094', 'Davi Machado Oliveira', 'davi.oliveira@email.com', @pw, 'Masculino', '11987650094', '1974-06-30', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000095', 'Selma Tavares Dutra', 'selma.dutra@email.com', @pw, 'Feminino', '11987650095', '1987-03-08', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000096', 'Laércio Braga Costa', 'laercio.costa@email.com', @pw, 'Masculino', '11987650096', '1983-11-19', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000097', 'Ivone Araújo Lopes', 'ivone.lopes@email.com', @pw, 'Feminino', '11987650097', '1990-08-04', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000098', 'Tarcísio Freitas Borges', 'tarcisio.borges@email.com', @pw, 'Masculino', '11987650098', '1976-02-11', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000099', 'Glória Rezende Martins', 'gloria.martins@email.com', @pw, 'Feminino', '11987650099', '1994-10-23', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000100', 'Milton Siqueira Campos', 'milton.campos@email.com', @pw, 'Masculino', '11987650100', '1982-05-07', 'patient', 0, 1, @doc08, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000101', 'Janete Melo Nunes', 'janete.nunes@email.com', @pw, 'Feminino', '11987650101', '1991-07-15', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000102', 'Erasmo Leal Souza', 'erasmo.souza@email.com', @pw, 'Masculino', '11987650102', '1979-12-02', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000103', 'Neusa Barros Correia', 'neusa.correia@email.com', @pw, 'Feminino', '11987650103', '1996-03-28', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000104', 'Adilson Pires Gomes', 'adilson.gomes@email.com', @pw, 'Masculino', '11987650104', '1973-09-14', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000105', 'Conceição Moreira Fontes', 'conceicao.fontes@email.com', @pw, 'Feminino', '11987650105', '1985-06-21', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000106', 'Benedito Sampaio Rangel', 'benedito.rangel@email.com', @pw, 'Masculino', '11987650106', '1988-01-09', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000107', 'Iracema Dantas Vieira', 'iracema.vieira@email.com', @pw, 'Feminino', '11987650107', '1992-11-27', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000108', 'Osvaldo Queiroz Pereira', 'osvaldo.pereira@email.com', @pw, 'Masculino', '11987650108', '1977-04-16', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000109', 'Dalva Ferreira Rocha', 'dalva.rocha@email.com', @pw, 'Feminino', '11987650109', '1986-08-03', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000110', 'Arlindo Souza Medeiros', 'arlindo.medeiros@email.com', @pw, 'Masculino', '11987650110', '1981-02-25', 'patient', 0, 1, @doc09, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000111', 'Elza Monteiro Ribeiro', 'elza.ribeiro@email.com', @pw, 'Feminino', '11987650111', '1993-05-13', 'patient', 0, 1, @doc10, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000112', 'Silvio Andrade Nogueira', 'silvio.nogueira@email.com', @pw, 'Masculino', '11987650112', '1978-10-06', 'patient', 0, 1, @doc10, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000113', 'Aparecida Lima Castro', 'aparecida.castro@email.com', @pw, 'Feminino', '11987650113', '1995-02-19', 'patient', 0, 1, @doc10, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000114', 'Josué Figueiredo Braga', 'josue.braga@email.com', @pw, 'Masculino', '11987650114', '1972-07-22', 'patient', 0, 1, @doc10, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000115', 'Odete Cavalcanti Melo', 'odete.melo@email.com', @pw, 'Feminino', '11987650115', '1989-11-05', 'patient', 0, 1, @doc10, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000116', 'Alcides Brito Tavares', 'alcides.tavares@email.com', @pw, 'Masculino', '11987650116', '1984-04-18', 'patient', 0, 1, @doc10, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000117', 'Madalena Pinheiro Santos', 'madalena.santos@email.com', @pw, 'Feminino', '11987650117', '1997-08-30', 'patient', 0, 1, @doc10, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000118', 'Domingos Lacerda Reis', 'domingos.reis@email.com', @pw, 'Masculino', '11987650118', '1976-01-11', 'patient', 0, 1, @doc10, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000119', 'Eunice Correia Bastos', 'eunice.bastos@email.com', @pw, 'Feminino', '11987650119', '1990-06-24', 'patient', 0, 1, @doc10, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000120', 'Valdomiro Alves Fonseca', 'valdomiro.fonseca@email.com', @pw, 'Masculino', '11987650120', '1983-09-17', 'patient', 0, 1, @doc10, NOW(), NOW()),
-- Pacientes sem vínculo com médico (visíveis na busca global)
('p0000000-0000-4000-a000-000000000121', 'Aurora Pacheco Lima', 'aurora.lima@email.com', @pw, 'Feminino', '11987650121', '1991-03-09', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000122', 'Getúlio Moura Cardoso', 'getulio.cardoso@email.com', @pw, 'Masculino', '11987650122', '1980-07-21', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000123', 'Perpétua Nascimento Dias', 'perpetua.dias@email.com', @pw, 'Feminino', '11987650123', '1996-12-04', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000124', 'Anísio Gomes Oliveira', 'anisio.oliveira@email.com', @pw, 'Masculino', '11987650124', '1974-05-16', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000125', 'Zilda Rocha Teixeira', 'zilda.teixeira@email.com', @pw, 'Feminino', '11987650125', '1987-09-28', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000126', 'Ernesto Vieira Lopes', 'ernesto.lopes@email.com', @pw, 'Masculino', '11987650126', '1982-02-13', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000127', 'Teodora Almeida Rangel', 'teodora.rangel@email.com', @pw, 'Feminino', '11987650127', '1995-10-07', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000128', 'Felício Barbosa Cruz', 'felicio.cruz@email.com', @pw, 'Masculino', '11987650128', '1978-04-30', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000129', 'Leonor Freitas Souza', 'leonor.souza@email.com', @pw, 'Feminino', '11987650129', '1993-08-15', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000130', 'Amaro Martins Araújo', 'amaro.araujo@email.com', @pw, 'Masculino', '11987650130', '1976-01-22', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000131', 'Iolanda Costa Ferreira', 'iolanda.ferreira@email.com', @pw, 'Feminino', '11987650131', '1989-06-11', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000132', 'Norberto Dutra Pinto', 'norberto.pinto@email.com', @pw, 'Masculino', '11987650132', '1984-11-03', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000133', 'Francisca Leal Borges', 'francisca.borges@email.com', @pw, 'Feminino', '11987650133', '1997-03-26', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000134', 'Amadeu Correia Vasconcelos', 'amadeu.vasconcelos@email.com', @pw, 'Masculino', '11987650134', '1971-08-19', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000135', 'Raimunda Campos Pereira', 'raimunda.pereira@email.com', @pw, 'Feminino', '11987650135', '1992-01-14', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000136', 'Juvenal Souza Nogueira', 'juvenal.nogueira@email.com', @pw, 'Masculino', '11987650136', '1981-05-28', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000137', 'Sebastiana Matos Lima', 'sebastiana.lima@email.com', @pw, 'Feminino', '11987650137', '1986-10-09', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000138', 'Aristides Mendes Braga', 'aristides.braga@email.com', @pw, 'Masculino', '11987650138', '1975-03-01', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000139', 'Clotilde Andrade Sampaio', 'clotilde.sampaio@email.com', @pw, 'Feminino', '11987650139', '1994-07-17', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000140', 'Hermínio Faria Xavier', 'herminio.xavier@email.com', @pw, 'Masculino', '11987650140', '1979-12-30', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000141', 'Berenice Tavares Lins', 'berenice.lins@email.com', @pw, 'Feminino', '11987650141', '1988-04-12', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000142', 'Almiro Ribeiro Dantas', 'almiro.dantas@email.com', @pw, 'Masculino', '11987650142', '1983-09-05', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000143', 'Graziela Pires Moreira', 'graziela.moreira@email.com', @pw, 'Feminino', '11987650143', '1996-02-21', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000144', 'Heráclito Cardoso Melo', 'heraclito.melo@email.com', @pw, 'Masculino', '11987650144', '1972-06-14', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000145', 'Olívia Santos Pacheco', 'olivia.pacheco@email.com', @pw, 'Feminino', '11987650145', '1990-11-08', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000146', 'Salomão Vieira Rezende', 'salomao.rezende@email.com', @pw, 'Masculino', '11987650146', '1985-04-25', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000147', 'Leocádia Moraes Fontes', 'leocadia.fontes@email.com', @pw, 'Feminino', '11987650147', '1998-08-18', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000148', 'Euclides Alves Trindade', 'euclides.trindade@email.com', @pw, 'Masculino', '11987650148', '1977-01-07', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000149', 'Petronília Gomes Dutra', 'petronilia.dutra@email.com', @pw, 'Feminino', '11987650149', '1991-05-30', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000150', 'Tibúrcio Nascimento Brito', 'tiburcio.brito@email.com', @pw, 'Masculino', '11987650150', '1984-10-13', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000151', 'Norma Costa Leal', 'norma.leal@email.com', @pw, 'Feminino', '11987650151', '1986-06-06', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000152', 'Astolfo Reis Machado', 'astolfo.machado@email.com', @pw, 'Masculino', '11987650152', '1973-02-18', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000153', 'Magnólia Souza Alencar', 'magnolia.alencar@email.com', @pw, 'Feminino', '11987650153', '1995-09-11', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000154', 'Deoclécio Lima Fonseca', 'deoclecio.fonseca@email.com', @pw, 'Masculino', '11987650154', '1980-03-24', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000155', 'Alzira Martins Cavalcanti', 'alzira.cavalcanti@email.com', @pw, 'Feminino', '11987650155', '1993-12-16', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000156', 'Venâncio Borges Dias', 'venancio.dias@email.com', @pw, 'Masculino', '11987650156', '1978-07-29', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000157', 'Efigênia Rocha Prado', 'efigenia.prado@email.com', @pw, 'Feminino', '11987650157', '1989-01-21', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000158', 'Bartolomeu Ferreira Queiroz', 'bartolomeu.queiroz@email.com', @pw, 'Masculino', '11987650158', '1982-08-14', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000159', 'Hortência Oliveira Medeiros', 'hortencia.medeiros@email.com', @pw, 'Feminino', '11987650159', '1997-04-05', 'patient', 0, 1, NULL, NOW(), NOW()),
('p0000000-0000-4000-a000-000000000160', 'Plínio Barros Moura', 'plinio.moura@email.com', @pw, 'Masculino', '11987650160', '1975-11-27', 'patient', 0, 1, NULL, NOW(), NOW());

-- ============================================================================
-- 5. PERMISSÕES
-- ============================================================================

-- Hipócrates (admin) → acesso aos primeiros 20 pacientes
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000001', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000002', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000003', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000004', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000005', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000006', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000007', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000008', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000009', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000010', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000011', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000012', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000013', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000014', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000015', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000016', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000017', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000018', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000019', 1, NOW()),
(UUID(), @doc_admin, 'p0000000-0000-4000-a000-000000000020', 1, NOW());

-- Dra. Camila (doc01) → pacientes 21-30
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000021', 1, NOW()),
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000022', 1, NOW()),
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000023', 1, NOW()),
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000024', 1, NOW()),
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000025', 1, NOW()),
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000026', 1, NOW()),
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000027', 1, NOW()),
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000028', 1, NOW()),
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000029', 1, NOW()),
(UUID(), @doc01, 'p0000000-0000-4000-a000-000000000030', 1, NOW());

-- Dr. Rafael (doc02) → pacientes 31-40
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000031', 1, NOW()),
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000032', 1, NOW()),
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000033', 1, NOW()),
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000034', 1, NOW()),
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000035', 1, NOW()),
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000036', 1, NOW()),
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000037', 1, NOW()),
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000038', 1, NOW()),
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000039', 1, NOW()),
(UUID(), @doc02, 'p0000000-0000-4000-a000-000000000040', 1, NOW());

-- Dra. Juliana (doc03) → pacientes 41-50
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000041', 1, NOW()),
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000042', 1, NOW()),
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000043', 1, NOW()),
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000044', 1, NOW()),
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000045', 1, NOW()),
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000046', 1, NOW()),
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000047', 1, NOW()),
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000048', 1, NOW()),
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000049', 1, NOW()),
(UUID(), @doc03, 'p0000000-0000-4000-a000-000000000050', 1, NOW());

-- Dr. Bruno (doc04) → pacientes 51-60
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000051', 1, NOW()),
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000052', 1, NOW()),
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000053', 1, NOW()),
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000054', 1, NOW()),
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000055', 1, NOW()),
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000056', 1, NOW()),
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000057', 1, NOW()),
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000058', 1, NOW()),
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000059', 1, NOW()),
(UUID(), @doc04, 'p0000000-0000-4000-a000-000000000060', 1, NOW());

-- Dra. Fernanda (doc05) → pacientes 61-70
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000061', 1, NOW()),
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000062', 1, NOW()),
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000063', 1, NOW()),
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000064', 1, NOW()),
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000065', 1, NOW()),
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000066', 1, NOW()),
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000067', 1, NOW()),
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000068', 1, NOW()),
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000069', 1, NOW()),
(UUID(), @doc05, 'p0000000-0000-4000-a000-000000000070', 1, NOW());

-- Dr. Marcos (doc06) → pacientes 71-80
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000071', 1, NOW()),
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000072', 1, NOW()),
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000073', 1, NOW()),
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000074', 1, NOW()),
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000075', 1, NOW()),
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000076', 1, NOW()),
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000077', 1, NOW()),
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000078', 1, NOW()),
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000079', 1, NOW()),
(UUID(), @doc06, 'p0000000-0000-4000-a000-000000000080', 1, NOW());

-- Dra. Patrícia (doc07) → pacientes 81-90
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000081', 1, NOW()),
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000082', 1, NOW()),
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000083', 1, NOW()),
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000084', 1, NOW()),
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000085', 1, NOW()),
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000086', 1, NOW()),
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000087', 1, NOW()),
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000088', 1, NOW()),
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000089', 1, NOW()),
(UUID(), @doc07, 'p0000000-0000-4000-a000-000000000090', 1, NOW());

-- Dr. Diego (doc08) → pacientes 91-100
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000091', 1, NOW()),
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000092', 1, NOW()),
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000093', 1, NOW()),
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000094', 1, NOW()),
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000095', 1, NOW()),
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000096', 1, NOW()),
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000097', 1, NOW()),
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000098', 1, NOW()),
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000099', 1, NOW()),
(UUID(), @doc08, 'p0000000-0000-4000-a000-000000000100', 1, NOW());

-- Dra. Larissa (doc09) → pacientes 101-110
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000101', 1, NOW()),
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000102', 1, NOW()),
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000103', 1, NOW()),
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000104', 1, NOW()),
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000105', 1, NOW()),
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000106', 1, NOW()),
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000107', 1, NOW()),
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000108', 1, NOW()),
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000109', 1, NOW()),
(UUID(), @doc09, 'p0000000-0000-4000-a000-000000000110', 1, NOW());

-- Dr. Thiago (doc10) → pacientes 111-120
INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000111', 1, NOW()),
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000112', 1, NOW()),
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000113', 1, NOW()),
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000114', 1, NOW()),
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000115', 1, NOW()),
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000116', 1, NOW()),
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000117', 1, NOW()),
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000118', 1, NOW()),
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000119', 1, NOW()),
(UUID(), @doc10, 'p0000000-0000-4000-a000-000000000120', 1, NOW());

-- ============================================================================
-- 6. VERIFICAÇÃO
-- ============================================================================
SELECT '=== RESUMO DO SEED ===' AS info;
SELECT 'Clínica' AS entidade, COUNT(*) AS total FROM clinics
UNION ALL SELECT 'Médicos', COUNT(*) FROM doctors
UNION ALL SELECT 'Memberships', COUNT(*) FROM clinic_memberships
UNION ALL SELECT 'Pacientes', COUNT(*) FROM patients
UNION ALL SELECT 'Permissões', COUNT(*) FROM doctor_permissions;

SELECT '=== LOGIN ===' AS info;
SELECT 'Admin: hipocrates@email.com / Fernando958969++' AS credenciais
UNION ALL SELECT 'Todos os médicos: [email]@email.com / Fernando958969++';
