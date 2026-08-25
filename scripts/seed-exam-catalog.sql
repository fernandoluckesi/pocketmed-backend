-- ============================================================
-- PocketMed - Seed de Catálogo de Exames
-- Execute este script no DBeaver conectado ao banco de produção
-- Executar cada bloco separadamente se necessário
-- ============================================================

-- 1. Criar categorias (executar primeiro)
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Hematologia', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Bioquímica', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Hormônios', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Imunologia e Sorologia', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Urinálise', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Microbiologia', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Coagulação', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Marcadores Tumorais', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Cardiologia', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Imagem', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Endoscopia', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Genética', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Toxicologia', NOW(), NOW());
INSERT INTO exam_categories (id, name, createdAt, updatedAt) VALUES
(UUID(), 'Parasitologia', NOW(), NOW());

-- 2. Inserir exames - Hematologia
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Hemograma Completo', 'CBC, hemograma', (SELECT id FROM exam_categories WHERE name = 'Hematologia' LIMIT 1), 'Jejum de 4 horas recomendado', 30, 25.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Hemoglobina Glicada (HbA1c)', 'A1C, glicada', (SELECT id FROM exam_categories WHERE name = 'Hematologia' LIMIT 1), NULL, 60, 35.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Velocidade de Hemossedimentação (VHS)', 'VHS, ESR', (SELECT id FROM exam_categories WHERE name = 'Hematologia' LIMIT 1), NULL, 60, 15.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Reticulócitos', NULL, (SELECT id FROM exam_categories WHERE name = 'Hematologia' LIMIT 1), NULL, 30, 20.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Ferro Sérico', NULL, (SELECT id FROM exam_categories WHERE name = 'Hematologia' LIMIT 1), 'Jejum de 8 horas', 30, 20.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Ferritina', NULL, (SELECT id FROM exam_categories WHERE name = 'Hematologia' LIMIT 1), 'Jejum de 4 horas', 60, 30.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Transferrina', NULL, (SELECT id FROM exam_categories WHERE name = 'Hematologia' LIMIT 1), NULL, 60, 30.00, 1, NOW(), NOW());

-- 3. Inserir exames - Bioquímica
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Glicose em Jejum', 'glicemia de jejum', (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), 'Jejum de 8 a 12 horas', 15, 10.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Colesterol Total', NULL, (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), 'Jejum de 12 horas', 30, 12.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'HDL Colesterol', NULL, (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), 'Jejum de 12 horas', 30, 12.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'LDL Colesterol', NULL, (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), 'Jejum de 12 horas', 30, 12.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Triglicerídeos', 'triglicérides', (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), 'Jejum de 12 horas', 30, 12.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Perfil Lipídico Completo', 'lipidograma', (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), 'Jejum de 12 horas', 30, 45.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Ureia', 'BUN', (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), NULL, 30, 10.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Creatinina', NULL, (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), NULL, 30, 10.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Ácido Úrico', NULL, (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), NULL, 30, 12.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'TGO (AST)', 'aspartato aminotransferase', (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), NULL, 30, 12.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'TGP (ALT)', 'alanina aminotransferase', (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), NULL, 30, 12.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Gama GT (GGT)', 'gama glutamil transferase', (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), NULL, 30, 15.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Vitamina D (25-OH)', NULL, (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), NULL, 120, 60.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Vitamina B12', NULL, (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), NULL, 120, 40.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Proteína C Reativa (PCR)', 'CRP', (SELECT id FROM exam_categories WHERE name = 'Bioquímica' LIMIT 1), NULL, 60, 20.00, 1, NOW(), NOW());

-- 4. Inserir exames - Hormônios
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'TSH', 'tireotrofina', (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), NULL, 60, 25.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'T4 Livre', 'tiroxina livre', (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), NULL, 60, 25.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Testosterona Total', NULL, (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), NULL, 60, 35.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Estradiol', NULL, (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), NULL, 60, 30.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'FSH', 'folículo estimulante', (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), NULL, 60, 25.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'LH', 'luteinizante', (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), NULL, 60, 25.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Cortisol', NULL, (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), 'Coleta pela manhã (7-9h)', 60, 30.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Insulina', NULL, (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), 'Jejum de 8 horas', 60, 30.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Beta-HCG Quantitativo', 'teste de gravidez', (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), NULL, 60, 25.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'PSA Total', 'antígeno prostático', (SELECT id FROM exam_categories WHERE name = 'Hormônios' LIMIT 1), 'Abstinência sexual 48h', 60, 30.00, 1, NOW(), NOW());

-- 5. Inserir exames - Imunologia e Sorologia
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'HIV 1 e 2 (Anti-HIV)', NULL, (SELECT id FROM exam_categories WHERE name = 'Imunologia e Sorologia' LIMIT 1), NULL, 60, 25.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'VDRL', 'sífilis', (SELECT id FROM exam_categories WHERE name = 'Imunologia e Sorologia' LIMIT 1), NULL, 30, 15.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Hepatite B (HBsAg)', NULL, (SELECT id FROM exam_categories WHERE name = 'Imunologia e Sorologia' LIMIT 1), NULL, 60, 25.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Hepatite C (Anti-HCV)', NULL, (SELECT id FROM exam_categories WHERE name = 'Imunologia e Sorologia' LIMIT 1), NULL, 60, 30.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Toxoplasmose IgG e IgM', NULL, (SELECT id FROM exam_categories WHERE name = 'Imunologia e Sorologia' LIMIT 1), NULL, 60, 35.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'FAN (Fator Antinuclear)', NULL, (SELECT id FROM exam_categories WHERE name = 'Imunologia e Sorologia' LIMIT 1), NULL, 120, 40.00, 1, NOW(), NOW());

-- 6. Inserir exames - Urinálise
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'EAS (Urina Tipo I)', 'urina rotina, sumário de urina', (SELECT id FROM exam_categories WHERE name = 'Urinálise' LIMIT 1), 'Coletar primeira urina da manhã', 30, 12.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Urocultura com Antibiograma', NULL, (SELECT id FROM exam_categories WHERE name = 'Urinálise' LIMIT 1), 'Coletar jato médio', 4320, 35.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Clearance de Creatinina', NULL, (SELECT id FROM exam_categories WHERE name = 'Urinálise' LIMIT 1), 'Coleta de urina de 24h', 1440, 25.00, 1, NOW(), NOW());

-- 7. Inserir exames - Coagulação
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Tempo de Protrombina (TP/INR)', 'TAP, INR', (SELECT id FROM exam_categories WHERE name = 'Coagulação' LIMIT 1), NULL, 30, 15.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'D-Dímero', NULL, (SELECT id FROM exam_categories WHERE name = 'Coagulação' LIMIT 1), NULL, 60, 50.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Fibrinogênio', NULL, (SELECT id FROM exam_categories WHERE name = 'Coagulação' LIMIT 1), NULL, 30, 20.00, 1, NOW(), NOW());

-- 8. Inserir exames - Marcadores Tumorais
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'CEA (Antígeno Carcinoembrionário)', NULL, (SELECT id FROM exam_categories WHERE name = 'Marcadores Tumorais' LIMIT 1), NULL, 120, 40.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'CA 125', NULL, (SELECT id FROM exam_categories WHERE name = 'Marcadores Tumorais' LIMIT 1), NULL, 120, 50.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'CA 19-9', NULL, (SELECT id FROM exam_categories WHERE name = 'Marcadores Tumorais' LIMIT 1), NULL, 120, 50.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'AFP (Alfa-Fetoproteína)', NULL, (SELECT id FROM exam_categories WHERE name = 'Marcadores Tumorais' LIMIT 1), NULL, 120, 40.00, 1, NOW(), NOW());

-- 9. Inserir exames - Cardiologia
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Eletrocardiograma (ECG)', NULL, (SELECT id FROM exam_categories WHERE name = 'Cardiologia' LIMIT 1), NULL, 15, 50.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Ecocardiograma', NULL, (SELECT id FROM exam_categories WHERE name = 'Cardiologia' LIMIT 1), NULL, 30, 200.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Teste Ergométrico', 'teste de esforço', (SELECT id FROM exam_categories WHERE name = 'Cardiologia' LIMIT 1), 'Usar roupa confortável e tênis', 60, 150.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Holter 24h', NULL, (SELECT id FROM exam_categories WHERE name = 'Cardiologia' LIMIT 1), NULL, 1440, 180.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Troponina', NULL, (SELECT id FROM exam_categories WHERE name = 'Cardiologia' LIMIT 1), NULL, 60, 40.00, 1, NOW(), NOW());

-- 10. Inserir exames - Imagem
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Raio-X de Tórax', NULL, (SELECT id FROM exam_categories WHERE name = 'Imagem' LIMIT 1), NULL, 15, 60.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Ultrassonografia Abdominal', NULL, (SELECT id FROM exam_categories WHERE name = 'Imagem' LIMIT 1), 'Jejum de 6 horas', 30, 120.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Ultrassonografia de Tireoide', NULL, (SELECT id FROM exam_categories WHERE name = 'Imagem' LIMIT 1), NULL, 20, 100.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Mamografia', NULL, (SELECT id FROM exam_categories WHERE name = 'Imagem' LIMIT 1), 'Não usar desodorante', 20, 150.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Tomografia Computadorizada (TC)', NULL, (SELECT id FROM exam_categories WHERE name = 'Imagem' LIMIT 1), 'Jejum de 4 horas se com contraste', 30, 350.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Ressonância Magnética (RM)', NULL, (SELECT id FROM exam_categories WHERE name = 'Imagem' LIMIT 1), 'Remover objetos metálicos', 45, 600.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Densitometria Óssea', NULL, (SELECT id FROM exam_categories WHERE name = 'Imagem' LIMIT 1), NULL, 20, 120.00, 1, NOW(), NOW());

-- 11. Inserir exames - Endoscopia
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Endoscopia Digestiva Alta', NULL, (SELECT id FROM exam_categories WHERE name = 'Endoscopia' LIMIT 1), 'Jejum de 8 horas', 30, 300.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Colonoscopia', NULL, (SELECT id FROM exam_categories WHERE name = 'Endoscopia' LIMIT 1), 'Preparo intestinal na véspera', 60, 450.00, 1, NOW(), NOW());

-- 12. Inserir exames - Genética
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'PCR para COVID-19', 'RT-PCR, SARS-CoV-2', (SELECT id FROM exam_categories WHERE name = 'Genética' LIMIT 1), 'Coleta nasofaríngea', 360, 150.00, 1, NOW(), NOW());

-- 13. Inserir exames - Toxicologia
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Teste Toxicológico', NULL, (SELECT id FROM exam_categories WHERE name = 'Toxicologia' LIMIT 1), NULL, 120, 80.00, 1, NOW(), NOW());

-- 14. Inserir exames - Parasitologia
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Parasitológico de Fezes (EPF)', 'protoparasitológico', (SELECT id FROM exam_categories WHERE name = 'Parasitologia' LIMIT 1), 'Coletar 3 amostras em dias alternados', 60, 15.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Pesquisa de Sangue Oculto nas Fezes', NULL, (SELECT id FROM exam_categories WHERE name = 'Parasitologia' LIMIT 1), 'Evitar carne vermelha 3 dias antes', 60, 20.00, 1, NOW(), NOW());

-- 15. Inserir exames - Microbiologia
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Hemocultura', NULL, (SELECT id FROM exam_categories WHERE name = 'Microbiologia' LIMIT 1), 'Coletar antes de antibiótico', 4320, 50.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Cultura de Secreção', NULL, (SELECT id FROM exam_categories WHERE name = 'Microbiologia' LIMIT 1), NULL, 4320, 40.00, 1, NOW(), NOW());
INSERT INTO exam_catalog (id, name, synonyms, categoryId, preparationInstructions, estimatedDuration, price, isActive, createdAt, updatedAt) VALUES
(UUID(), 'Pesquisa de BAAR', 'baciloscopia', (SELECT id FROM exam_categories WHERE name = 'Microbiologia' LIMIT 1), 'Coletar escarro pela manhã', 60, 20.00, 1, NOW(), NOW());
