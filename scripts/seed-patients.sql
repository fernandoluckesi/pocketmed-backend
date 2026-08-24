-- ============================================================================
-- Script: seed-patients.sql
-- Descrição: Insere 50 pacientes de teste e concede permissão de acesso
--            ao médico com email fernando.luckesi94@gmail.com para 30 deles.
--            Também marca os pacientes como criados por esse médico para que
--            apareçam na busca da clínica.
-- ============================================================================

-- Variável: ID do médico (buscar pelo email)
SET @doctor_id = (SELECT id FROM doctors WHERE email = 'fernando.luckesi94@gmail.com' LIMIT 1);

-- Senha hash para todos os pacientes: "Paciente@123" (bcrypt)
SET @password_hash = '$2b$10$LqT1qK5h8Q9Z3E6Rf3JY5.BkTLG4wYl1xD0qH7V2pN8mZ3oK9jW6e';

-- ============================================================================
-- Inserir 50 pacientes
-- ============================================================================

INSERT INTO patients (id, name, email, password, gender, phone, birthDate, type, isShadow, emailVerified, doctorCreatorId, createdAt, updatedAt) VALUES
(UUID(), 'Maria Silva Santos', 'maria.silva01@test.com', @password_hash, 'Feminino', '11987654301', '1985-03-15', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'João Pedro Oliveira', 'joao.oliveira02@test.com', @password_hash, 'Masculino', '11987654302', '1990-07-22', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Ana Carolina Souza', 'ana.souza03@test.com', @password_hash, 'Feminino', '11987654303', '1978-11-08', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Carlos Eduardo Lima', 'carlos.lima04@test.com', @password_hash, 'Masculino', '11987654304', '1995-01-30', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Fernanda Costa Alves', 'fernanda.alves05@test.com', @password_hash, 'Feminino', '11987654305', '1982-05-12', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Ricardo Mendes Ferreira', 'ricardo.ferreira06@test.com', @password_hash, 'Masculino', '11987654306', '1988-09-25', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Patricia Rodrigues Nunes', 'patricia.nunes07@test.com', @password_hash, 'Feminino', '11987654307', '1992-04-18', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Bruno Carvalho Dias', 'bruno.dias08@test.com', @password_hash, 'Masculino', '11987654308', '1975-12-03', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Camila Barbosa Martins', 'camila.martins09@test.com', @password_hash, 'Feminino', '11987654309', '1998-08-27', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Diego Araujo Pereira', 'diego.pereira10@test.com', @password_hash, 'Masculino', '11987654310', '1983-06-14', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Juliana Nascimento Rocha', 'juliana.rocha11@test.com', @password_hash, 'Feminino', '11987654311', '1991-02-09', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Thiago Gomes Ribeiro', 'thiago.ribeiro12@test.com', @password_hash, 'Masculino', '11987654312', '1987-10-21', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Larissa Fernandes Castro', 'larissa.castro13@test.com', @password_hash, 'Feminino', '11987654313', '1994-07-05', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Rafael Santos Correia', 'rafael.correia14@test.com', @password_hash, 'Masculino', '11987654314', '1980-03-28', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Beatriz Moreira Vieira', 'beatriz.vieira15@test.com', @password_hash, 'Feminino', '11987654315', '1996-11-16', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Lucas Almeida Teixeira', 'lucas.teixeira16@test.com', @password_hash, 'Masculino', '11987654316', '1989-01-07', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Gabriela Lopes Cardoso', 'gabriela.cardoso17@test.com', @password_hash, 'Feminino', '11987654317', '1977-08-23', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Marcos Vinicius Pinto', 'marcos.pinto18@test.com', @password_hash, 'Masculino', '11987654318', '1993-05-11', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Aline Freitas Monteiro', 'aline.monteiro19@test.com', @password_hash, 'Feminino', '11987654319', '1986-12-30', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Felipe Ramos Azevedo', 'felipe.azevedo20@test.com', @password_hash, 'Masculino', '11987654320', '1999-04-02', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Renata Cunha Borges', 'renata.borges21@test.com', @password_hash, 'Feminino', '11987654321', '1984-09-19', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Gustavo Henrique Melo', 'gustavo.melo22@test.com', @password_hash, 'Masculino', '11987654322', '1976-06-07', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Isabela Duarte Campos', 'isabela.campos23@test.com', @password_hash, 'Feminino', '11987654323', '1997-02-14', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Leandro Sousa Medeiros', 'leandro.medeiros24@test.com', @password_hash, 'Masculino', '11987654324', '1981-10-26', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Vanessa Pires Cavalcanti', 'vanessa.cavalcanti25@test.com', @password_hash, 'Feminino', '11987654325', '1990-07-08', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Anderson Reis Figueiredo', 'anderson.figueiredo26@test.com', @password_hash, 'Masculino', '11987654326', '1974-04-17', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Tatiana Moura Xavier', 'tatiana.xavier27@test.com', @password_hash, 'Feminino', '11987654327', '1993-01-23', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Rodrigo Fonseca Barros', 'rodrigo.barros28@test.com', @password_hash, 'Masculino', '11987654328', '1988-08-11', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Priscila Andrade Rezende', 'priscila.rezende29@test.com', @password_hash, 'Feminino', '11987654329', '1979-05-29', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Eduardo Machado Sampaio', 'eduardo.sampaio30@test.com', @password_hash, 'Masculino', '11987654330', '1995-12-04', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Daniela Vasconcelos Cruz', 'daniela.cruz31@test.com', @password_hash, 'Feminino', '11987654331', '1986-03-16', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Henrique Batista Leal', 'henrique.leal32@test.com', @password_hash, 'Masculino', '11987654332', '1992-11-22', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Luciana Tavares Brito', 'luciana.brito33@test.com', @password_hash, 'Feminino', '11987654333', '1983-07-09', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Matheus Coelho Guimarães', 'matheus.guimaraes34@test.com', @password_hash, 'Masculino', '11987654334', '1997-09-01', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Simone Pacheco Amaral', 'simone.amaral35@test.com', @password_hash, 'Feminino', '11987654335', '1980-02-18', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Vinícius Nogueira Sales', 'vinicius.sales36@test.com', @password_hash, 'Masculino', '11987654336', '1991-06-25', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Amanda Pinheiro Lacerda', 'amanda.lacerda37@test.com', @password_hash, 'Feminino', '11987654337', '1976-10-13', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Pedro Henrique Siqueira', 'pedro.siqueira38@test.com', @password_hash, 'Masculino', '11987654338', '1994-04-07', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Raquel Aguiar Coutinho', 'raquel.coutinho39@test.com', @password_hash, 'Feminino', '11987654339', '1987-01-20', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Fábio Cardoso Miranda', 'fabio.miranda40@test.com', @password_hash, 'Masculino', '11987654340', '1982-08-06', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Cristiane Magalhães Assis', 'cristiane.assis41@test.com', @password_hash, 'Feminino', '11987654341', '1996-05-31', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Alexandre Bastos Alencar', 'alexandre.alencar42@test.com', @password_hash, 'Masculino', '11987654342', '1979-12-15', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Elisa Queiroz Faria', 'elisa.faria43@test.com', @password_hash, 'Feminino', '11987654343', '1993-03-24', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Roberto Silveira Lopes', 'roberto.lopes44@test.com', @password_hash, 'Masculino', '11987654344', '1985-11-08', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Michele Torres Rangel', 'michele.rangel45@test.com', @password_hash, 'Feminino', '11987654345', '1990-06-19', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Caio Domingues Vargas', 'caio.vargas46@test.com', @password_hash, 'Masculino', '11987654346', '1977-09-02', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Mariana Esteves Paiva', 'mariana.paiva47@test.com', @password_hash, 'Feminino', '11987654347', '1998-01-28', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Wagner Bezerra Trindade', 'wagner.trindade48@test.com', @password_hash, 'Masculino', '11987654348', '1984-07-14', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Sabrina Matos Serrano', 'sabrina.serrano49@test.com', @password_hash, 'Feminino', '11987654349', '1989-04-06', 'patient', 0, 1, @doctor_id, NOW(), NOW()),
(UUID(), 'Leonardo Braga Fontenele', 'leonardo.fontenele50@test.com', @password_hash, 'Masculino', '11987654350', '1981-10-20', 'patient', 0, 1, @doctor_id, NOW(), NOW());

-- ============================================================================
-- Conceder permissão de acesso ao médico para os primeiros 30 pacientes
-- ============================================================================

INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt)
SELECT UUID(), @doctor_id, p.id, 1, NOW()
FROM patients p
WHERE p.email IN (
  'maria.silva01@test.com',
  'joao.oliveira02@test.com',
  'ana.souza03@test.com',
  'carlos.lima04@test.com',
  'fernanda.alves05@test.com',
  'ricardo.ferreira06@test.com',
  'patricia.nunes07@test.com',
  'bruno.dias08@test.com',
  'camila.martins09@test.com',
  'diego.pereira10@test.com',
  'juliana.rocha11@test.com',
  'thiago.ribeiro12@test.com',
  'larissa.castro13@test.com',
  'rafael.correia14@test.com',
  'beatriz.vieira15@test.com',
  'lucas.teixeira16@test.com',
  'gabriela.cardoso17@test.com',
  'marcos.pinto18@test.com',
  'aline.monteiro19@test.com',
  'felipe.azevedo20@test.com',
  'renata.borges21@test.com',
  'gustavo.melo22@test.com',
  'isabela.campos23@test.com',
  'leandro.medeiros24@test.com',
  'vanessa.cavalcanti25@test.com',
  'anderson.figueiredo26@test.com',
  'tatiana.xavier27@test.com',
  'rodrigo.barros28@test.com',
  'priscila.rezende29@test.com',
  'eduardo.sampaio30@test.com'
)
AND @doctor_id IS NOT NULL;

-- ============================================================================
-- Verificação
-- ============================================================================
SELECT COUNT(*) AS total_pacientes_inseridos FROM patients WHERE email LIKE '%@test.com';
SELECT COUNT(*) AS total_permissoes FROM doctor_permissions WHERE doctorId = @doctor_id;
