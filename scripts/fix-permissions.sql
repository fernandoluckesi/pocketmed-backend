-- ============================================================================
-- Fix: Garantir que o médico 80a666ea-049a-4dc3-8b09-9bc0a47fc4a5 
-- (fernando.luckesi94@gmail.com) tem permissão de acesso aos 30 primeiros 
-- pacientes de teste.
-- ============================================================================

SET @doctor_id = '80a666ea-049a-4dc3-8b09-9bc0a47fc4a5';

-- Verificar se o médico existe
SELECT id, email FROM doctors WHERE id = @doctor_id;

-- Atualizar doctorCreatorId nos pacientes de teste (para que apareçam em "Meus Pacientes")
UPDATE patients SET doctorCreatorId = @doctor_id WHERE email LIKE '%@test.com';

-- Remover permissions antigas (se existirem) para evitar duplicatas
DELETE FROM doctor_permissions WHERE doctorId = @doctor_id AND patientId IN (
  SELECT id FROM patients WHERE email LIKE '%@test.com'
);

-- Inserir permissões para os primeiros 30 pacientes
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
);

-- Verificação
SELECT COUNT(*) AS pacientes_com_creator FROM patients WHERE doctorCreatorId = @doctor_id;
SELECT COUNT(*) AS permissoes_ativas FROM doctor_permissions WHERE doctorId = @doctor_id AND isActive = 1;
