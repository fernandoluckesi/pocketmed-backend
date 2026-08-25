-- ============================================================
-- PocketMed - Seed Completo (Clínica + Médicos + Pacientes + Dados Clínicos)
-- Execute no DBeaver com "Execute SQL Script" (Alt+X / Ctrl+Shift+Enter)
-- Senha de todos: Fernando958969++
-- ============================================================

-- Hash bcrypt de "Fernando958969++"
SET @pwd = '$2b$10$53mTI7xTmAlD5h7ESslLF.uz0YJCyeWIzQX2CjV/Mz8fmCAzquPS2';

-- ============================================================
-- 1. CLÍNICA
-- ============================================================
SET @clinic_id = UUID();
INSERT INTO clinics (id, name, cnpj, isActive, city, state, createdAt, updatedAt)
VALUES (@clinic_id, 'Clínica Hipócrates', '12345678000199', 1, 'São Paulo', 'SP', NOW(), NOW());

-- ============================================================
-- 2. MÉDICOS (10)
-- ============================================================
SET @doc1 = UUID();
SET @doc2 = UUID();
SET @doc3 = UUID();
SET @doc4 = UUID();
SET @doc5 = UUID();
SET @doc6 = UUID();
SET @doc7 = UUID();
SET @doc8 = UUID();
SET @doc9 = UUID();
SET @doc10 = UUID();

INSERT INTO doctors (id, name, email, password, gender, phone, birthDate, specialty, crm, cpf, type, isShadow, emailVerified, createdAt, updatedAt) VALUES
(@doc1, 'Dr. Hipócrates', 'hipocrates@email.com', @pwd, 'Masculino', '11900000001', '1975-03-15', 'Clínica Geral', '100001/SP', '10000000001', 'doctor', 0, 1, NOW(), NOW()),
(@doc2, 'Dra. Helena Cardoso', 'helena.cardoso@email.com', @pwd, 'Feminino', '11900000002', '1980-07-22', 'Cardiologia', '100002/SP', '10000000002', 'doctor', 0, 1, NOW(), NOW()),
(@doc3, 'Dr. Ricardo Mendes', 'ricardo.mendes@email.com', @pwd, 'Masculino', '11900000003', '1978-11-10', 'Neurologia', '100003/SP', '10000000003', 'doctor', 0, 1, NOW(), NOW()),
(@doc4, 'Dra. Camila Ferreira', 'camila.ferreira@email.com', @pwd, 'Feminino', '11900000004', '1982-04-05', 'Pediatria', '100004/SP', '10000000004', 'doctor', 0, 1, NOW(), NOW()),
(@doc5, 'Dr. André Oliveira', 'andre.oliveira@email.com', @pwd, 'Masculino', '11900000005', '1976-09-18', 'Ortopedia', '100005/SP', '10000000005', 'doctor', 0, 1, NOW(), NOW()),
(@doc6, 'Dra. Juliana Costa', 'juliana.costa@email.com', @pwd, 'Feminino', '11900000006', '1984-01-30', 'Dermatologia', '100006/SP', '10000000006', 'doctor', 0, 1, NOW(), NOW()),
(@doc7, 'Dr. Marcos Pereira', 'marcos.pereira@email.com', @pwd, 'Masculino', '11900000007', '1979-06-12', 'Endocrinologia', '100007/SP', '10000000007', 'doctor', 0, 1, NOW(), NOW()),
(@doc8, 'Dra. Fernanda Lima', 'fernanda.lima@email.com', @pwd, 'Feminino', '11900000008', '1981-08-25', 'Ginecologia', '100008/SP', '10000000008', 'doctor', 0, 1, NOW(), NOW()),
(@doc9, 'Dr. Lucas Ribeiro', 'lucas.ribeiro@email.com', @pwd, 'Masculino', '11900000009', '1983-12-03', 'Pneumologia', '100009/SP', '10000000009', 'doctor', 0, 1, NOW(), NOW()),
(@doc10, 'Dra. Beatriz Santos', 'beatriz.santos@email.com', @pwd, 'Feminino', '11900000010', '1985-02-14', 'Oftalmologia', '100010/SP', '10000000010', 'doctor', 0, 1, NOW(), NOW());

-- ============================================================
-- 3. MEMBROS DA CLÍNICA (todos os 10 médicos)
-- ============================================================
INSERT INTO clinic_memberships (id, clinicId, professionalId, role, isActive, invitedBy, createdAt, updatedAt) VALUES
(UUID(), @clinic_id, @doc1, 'admin', 1, NULL, NOW(), NOW()),
(UUID(), @clinic_id, @doc2, 'doctor', 1, @doc1, NOW(), NOW()),
(UUID(), @clinic_id, @doc3, 'doctor', 1, @doc1, NOW(), NOW()),
(UUID(), @clinic_id, @doc4, 'doctor', 1, @doc1, NOW(), NOW()),
(UUID(), @clinic_id, @doc5, 'doctor', 1, @doc1, NOW(), NOW()),
(UUID(), @clinic_id, @doc6, 'doctor', 1, @doc1, NOW(), NOW()),
(UUID(), @clinic_id, @doc7, 'doctor', 1, @doc1, NOW(), NOW()),
(UUID(), @clinic_id, @doc8, 'doctor', 1, @doc1, NOW(), NOW()),
(UUID(), @clinic_id, @doc9, 'doctor', 1, @doc1, NOW(), NOW()),
(UUID(), @clinic_id, @doc10, 'doctor', 1, @doc1, NOW(), NOW());

-- ============================================================
-- 4. PACIENTES (150)
-- ============================================================
-- Vamos criar com um procedimento para gerar 150 pacientes
DROP PROCEDURE IF EXISTS seed_patients;
DELIMITER //
CREATE PROCEDURE seed_patients()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE p_id VARCHAR(36);
  DECLARE p_name VARCHAR(255);
  DECLARE p_email VARCHAR(255);
  DECLARE p_gender VARCHAR(20);
  DECLARE p_phone VARCHAR(20);
  DECLARE p_birth DATE;

  WHILE i <= 150 DO
    SET p_id = UUID();
    SET p_name = CONCAT(
      ELT(1 + (i % 25), 'Ana','Bruno','Carla','Diego','Elisa','Fabio','Gabriela','Henrique','Isabela','João',
      'Karen','Leonardo','Mariana','Nicolas','Olivia','Paulo','Rafaela','Samuel','Tatiana','Ulisses',
      'Valentina','Wesley','Ximena','Yuri','Zilda'),
      ' ',
      ELT(1 + ((i DIV 25) % 6), 'Silva','Santos','Oliveira','Souza','Ferreira','Almeida')
    );
    SET p_email = CONCAT('paciente', i, '@email.com');
    SET p_gender = IF(i % 2 = 0, 'Feminino', 'Masculino');
    SET p_phone = CONCAT('1198', LPAD(i, 7, '0'));
    SET p_birth = DATE_ADD('1970-01-01', INTERVAL (i * 73) DAY);

    INSERT INTO patients (id, name, email, password, gender, phone, birthDate, type, isShadow, emailVerified, createdAt, updatedAt)
    VALUES (p_id, p_name, p_email, @pwd, p_gender, p_phone, p_birth, 'patient', 0, 1, NOW(), NOW());

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL seed_patients();
DROP PROCEDURE IF EXISTS seed_patients;

-- ============================================================
-- 5. PERMISSÕES (distribuir pacientes entre médicos)
-- Pacientes 1-20: Dr. Hipócrates (doc1)
-- Pacientes 21-30: doc2, 31-40: doc3, 41-50: doc4, 51-60: doc5
-- Pacientes 61-70: doc6, 71-80: doc7, 81-90: doc8, 91-100: doc9
-- Pacientes 101-110: doc10
-- Pacientes 111-150: sem médico vinculado (novos)
-- ============================================================
DROP PROCEDURE IF EXISTS seed_permissions;
DELIMITER //
CREATE PROCEDURE seed_permissions()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE p_id VARCHAR(36);
  DECLARE d_id VARCHAR(36);

  WHILE i <= 120 DO
    SELECT id INTO p_id FROM patients WHERE email = CONCAT('paciente', i, '@email.com') LIMIT 1;

    IF p_id IS NOT NULL THEN
      IF i <= 20 THEN
        SET d_id = (SELECT id FROM doctors WHERE email = 'hipocrates@email.com');
      ELSEIF i <= 30 THEN
        SET d_id = (SELECT id FROM doctors WHERE email = 'helena.cardoso@email.com');
      ELSEIF i <= 40 THEN
        SET d_id = (SELECT id FROM doctors WHERE email = 'ricardo.mendes@email.com');
      ELSEIF i <= 50 THEN
        SET d_id = (SELECT id FROM doctors WHERE email = 'camila.ferreira@email.com');
      ELSEIF i <= 60 THEN
        SET d_id = (SELECT id FROM doctors WHERE email = 'andre.oliveira@email.com');
      ELSEIF i <= 70 THEN
        SET d_id = (SELECT id FROM doctors WHERE email = 'juliana.costa@email.com');
      ELSEIF i <= 80 THEN
        SET d_id = (SELECT id FROM doctors WHERE email = 'marcos.pereira@email.com');
      ELSEIF i <= 90 THEN
        SET d_id = (SELECT id FROM doctors WHERE email = 'fernanda.lima@email.com');
      ELSEIF i <= 100 THEN
        SET d_id = (SELECT id FROM doctors WHERE email = 'lucas.ribeiro@email.com');
      ELSE
        SET d_id = (SELECT id FROM doctors WHERE email = 'beatriz.santos@email.com');
      END IF;

      INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt)
      VALUES (UUID(), d_id, p_id, 1, NOW());
    END IF;

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL seed_permissions();
DROP PROCEDURE IF EXISTS seed_permissions;

-- ============================================================
-- 6. CONSULTAS (3 por paciente dos primeiros 50)
-- ============================================================
DROP PROCEDURE IF EXISTS seed_appointments;
DELIMITER //
CREATE PROCEDURE seed_appointments()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE p_id VARCHAR(36);
  DECLARE d_id VARCHAR(36);
  DECLARE d_name VARCHAR(255);
  DECLARE d_crm VARCHAR(20);
  DECLARE d_spec VARCHAR(100);

  WHILE i <= 50 DO
    SELECT id INTO p_id FROM patients WHERE email = CONCAT('paciente', i, '@email.com') LIMIT 1;

    IF i <= 20 THEN
      SELECT id, name, crm, specialty INTO d_id, d_name, d_crm, d_spec FROM doctors WHERE email = 'hipocrates@email.com';
    ELSEIF i <= 30 THEN
      SELECT id, name, crm, specialty INTO d_id, d_name, d_crm, d_spec FROM doctors WHERE email = 'helena.cardoso@email.com';
    ELSEIF i <= 40 THEN
      SELECT id, name, crm, specialty INTO d_id, d_name, d_crm, d_spec FROM doctors WHERE email = 'ricardo.mendes@email.com';
    ELSE
      SELECT id, name, crm, specialty INTO d_id, d_name, d_crm, d_spec FROM doctors WHERE email = 'camila.ferreira@email.com';
    END IF;

    IF p_id IS NOT NULL AND d_id IS NOT NULL THEN
      INSERT INTO appointments (id, doctorId, patientId, doctorName, doctorCrm, doctorSpecialty, reason, dateTime, isCompleted, status, createdAt, updatedAt) VALUES
      (UUID(), d_id, p_id, d_name, d_crm, d_spec, 'Consulta de rotina', DATE_SUB(NOW(), INTERVAL (90 + i) DAY), 1, 'completed', NOW(), NOW()),
      (UUID(), d_id, p_id, d_name, d_crm, d_spec, 'Retorno', DATE_SUB(NOW(), INTERVAL (30 + i) DAY), 1, 'completed', NOW(), NOW()),
      (UUID(), d_id, p_id, d_name, d_crm, d_spec, 'Acompanhamento', DATE_ADD(NOW(), INTERVAL (i * 2) DAY), 0, 'approved', NOW(), NOW());
    END IF;

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL seed_appointments();
DROP PROCEDURE IF EXISTS seed_appointments;

-- ============================================================
-- 7. EXAMES (3 por paciente dos primeiros 40)
-- ============================================================
DROP PROCEDURE IF EXISTS seed_exams;
DELIMITER //
CREATE PROCEDURE seed_exams()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE p_id VARCHAR(36);
  DECLARE d_id VARCHAR(36);

  WHILE i <= 40 DO
    SELECT id INTO p_id FROM patients WHERE email = CONCAT('paciente', i, '@email.com') LIMIT 1;
    SET d_id = (SELECT id FROM doctors WHERE email = 'hipocrates@email.com');

    IF p_id IS NOT NULL THEN
      INSERT INTO exams (id, name, type, description, scheduledDate, status, laboratory, doctorId, patientId, createdAt, updatedAt) VALUES
      (UUID(), 'Hemograma Completo', 'blood_test', 'Exame de sangue de rotina', DATE_SUB(CURDATE(), INTERVAL (60 + i) DAY), 'completed', 'Lab São Paulo', d_id, p_id, NOW(), NOW()),
      (UUID(), 'Glicose em Jejum', 'blood_test', 'Controle glicêmico', DATE_SUB(CURDATE(), INTERVAL (30 + i) DAY), 'completed', 'Lab São Paulo', d_id, p_id, NOW(), NOW()),
      (UUID(), 'Ultrassonografia Abdominal', 'ultrasound', 'Avaliação abdominal', DATE_ADD(CURDATE(), INTERVAL (i * 3) DAY), 'scheduled', 'Clínica Imagem', d_id, p_id, NOW(), NOW());
    END IF;

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL seed_exams();
DROP PROCEDURE IF EXISTS seed_exams;

-- ============================================================
-- 8. MEDICAMENTOS (3 por paciente dos primeiros 30)
-- ============================================================
DROP PROCEDURE IF EXISTS seed_medications;
DELIMITER //
CREATE PROCEDURE seed_medications()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE p_id VARCHAR(36);
  DECLARE d_id VARCHAR(36);

  WHILE i <= 30 DO
    SELECT id INTO p_id FROM patients WHERE email = CONCAT('paciente', i, '@email.com') LIMIT 1;
    SET d_id = (SELECT id FROM doctors WHERE email = 'hipocrates@email.com');

    IF p_id IS NOT NULL THEN
      INSERT INTO medications (id, name, dosage, frequency, times, startDate, isActive, isFinished, doctorId, patientId, createdAt, updatedAt) VALUES
      (UUID(), 'Losartana 50mg', '1 comprimido', 'once_daily', '["08:00"]', CURDATE(), 1, 0, d_id, p_id, NOW(), NOW()),
      (UUID(), 'Metformina 850mg', '1 comprimido', 'twice_daily', '["08:00","20:00"]', CURDATE(), 1, 0, d_id, p_id, NOW(), NOW()),
      (UUID(), 'Omeprazol 20mg', '1 cápsula', 'once_daily', '["07:00"]', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 0, 1, d_id, p_id, NOW(), NOW());
    END IF;

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL seed_medications();
DROP PROCEDURE IF EXISTS seed_medications;

-- ============================================================
-- 9. DOENÇAS (3 por paciente dos primeiros 25)
-- ============================================================
DROP PROCEDURE IF EXISTS seed_diseases;
DELIMITER //
CREATE PROCEDURE seed_diseases()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE p_id VARCHAR(36);
  DECLARE d_id VARCHAR(36);

  WHILE i <= 25 DO
    SELECT id INTO p_id FROM patients WHERE email = CONCAT('paciente', i, '@email.com') LIMIT 1;
    SET d_id = (SELECT id FROM doctors WHERE email = 'hipocrates@email.com');

    IF p_id IS NOT NULL THEN
      INSERT INTO patient_diseases (id, name, status, diagnosisDate, patientId, doctorId, createdAt, updatedAt) VALUES
      (UUID(), 'Hipertensão Arterial', 'in_treatment', DATE_SUB(CURDATE(), INTERVAL 365 DAY), p_id, d_id, NOW(), NOW()),
      (UUID(), 'Diabetes Tipo 2', 'in_treatment', DATE_SUB(CURDATE(), INTERVAL 200 DAY), p_id, d_id, NOW(), NOW()),
      (UUID(), 'Hipotireoidismo', 'in_treatment', DATE_SUB(CURDATE(), INTERVAL 100 DAY), p_id, d_id, NOW(), NOW());
    END IF;

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL seed_diseases();
DROP PROCEDURE IF EXISTS seed_diseases;

-- ============================================================
-- 10. ALERGIAS (3 por paciente dos primeiros 20)
-- ============================================================
DROP PROCEDURE IF EXISTS seed_allergies;
DELIMITER //
CREATE PROCEDURE seed_allergies()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE p_id VARCHAR(36);
  DECLARE d_id VARCHAR(36);

  WHILE i <= 20 DO
    SELECT id INTO p_id FROM patients WHERE email = CONCAT('paciente', i, '@email.com') LIMIT 1;
    SET d_id = (SELECT id FROM doctors WHERE email = 'hipocrates@email.com');

    IF p_id IS NOT NULL THEN
      INSERT INTO patient_allergies (id, name, severity, reaction, patientId, doctorId, createdAt) VALUES
      (UUID(), 'Dipirona', 'severe', 'Edema de glote', p_id, d_id, NOW()),
      (UUID(), 'Penicilina', 'moderate', 'Urticária generalizada', p_id, d_id, NOW()),
      (UUID(), 'Frutos do mar', 'mild', 'Coceira leve', p_id, d_id, NOW());
    END IF;

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL seed_allergies();
DROP PROCEDURE IF EXISTS seed_allergies;

-- ============================================================
-- 11. VACINAS (3 por paciente dos primeiros 20)
-- ============================================================
DROP PROCEDURE IF EXISTS seed_vaccines;
DELIMITER //
CREATE PROCEDURE seed_vaccines()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE p_id VARCHAR(36);
  DECLARE d_id VARCHAR(36);

  WHILE i <= 20 DO
    SELECT id INTO p_id FROM patients WHERE email = CONCAT('paciente', i, '@email.com') LIMIT 1;
    SET d_id = (SELECT id FROM doctors WHERE email = 'hipocrates@email.com');

    IF p_id IS NOT NULL THEN
      INSERT INTO patient_vaccines (id, name, dose, applicationDate, laboratory, patientId, doctorId, createdAt) VALUES
      (UUID(), 'COVID-19 Pfizer', '3ª dose', '2024-03-15', 'Pfizer/BioNTech', p_id, d_id, NOW()),
      (UUID(), 'Influenza 2024', 'Dose única', '2024-04-20', 'Butantan', p_id, d_id, NOW()),
      (UUID(), 'Hepatite B', '3ª dose', '2023-08-10', 'Fiocruz', p_id, d_id, NOW());
    END IF;

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL seed_vaccines();
DROP PROCEDURE IF EXISTS seed_vaccines;

-- ============================================================
-- 12. DEPENDENTES (10 pacientes terão dependentes)
-- ============================================================
DROP PROCEDURE IF EXISTS seed_dependents;
DELIMITER //
CREATE PROCEDURE seed_dependents()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE p_id VARCHAR(36);
  DECLARE dep_id VARCHAR(36);

  WHILE i <= 10 DO
    SELECT id INTO p_id FROM patients WHERE email = CONCAT('paciente', i, '@email.com') LIMIT 1;

    IF p_id IS NOT NULL THEN
      SET dep_id = UUID();
      INSERT INTO dependents (id, name, gender, type, birthDate, adminResponsibleId, createdAt, updatedAt)
      VALUES (dep_id, CONCAT('Dependente de Pac ', i), IF(i % 2 = 0, 'Feminino', 'Masculino'), 'filho', DATE_SUB(CURDATE(), INTERVAL (i * 365 + 1000) DAY), p_id, NOW(), NOW());

      -- Vincular responsável
      INSERT INTO dependent_responsibles (dependentId, patientId) VALUES (dep_id, p_id);
    END IF;

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL seed_dependents();
DROP PROCEDURE IF EXISTS seed_dependents;

-- ============================================================
-- FIM DO SEED
-- Total: 1 clínica, 10 médicos, 150 pacientes, 10 dependentes
-- + consultas, exames, medicamentos, doenças, alergias, vacinas
-- Login: qualquer email acima com senha Fernando958969++
-- Admin da clínica: hipocrates@email.com
-- ============================================================
