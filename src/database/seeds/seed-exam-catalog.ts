import 'reflect-metadata';
import AppDataSource from '../data-source';
import { ExamCategory } from '../../entities/exam-category.entity';
import { ExamCatalog } from '../../entities/exam-catalog.entity';

// ─── Seed gerado a partir da lista oficial da Unimed Região da Campanha/RS ────
// Categorização baseada em classificação laboratorial clínica padrão (SBPC/ML)

const CATEGORIES = [
  'Hematologia',
  'Bioquímica',
  'Hormônios',
  'Imunologia e Sorologia',
  'Microbiologia',
  'Urina e Fezes',
  'Marcadores Tumorais',
  'Genética e Biologia Molecular',
  'Alergologia (IgE Específico)',
];

interface ExamSeedData {
  name: string;
  synonyms: string;
  categoryName: string;
  preparationInstructions: string;
  estimatedDuration: number;
  price: number;
}

const EXAMS: ExamSeedData[] = [
  // ── HEMATOLOGIA ──────────────────────────────────────────────────────────────
  { name: 'Hemograma', synonyms: 'Leucograma, CBC, hemograma completo', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Coagulograma', synonyms: 'coagulação, TP, TTPA', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'VHS', synonyms: 'Velocidade de Hemossedimentação, ESR, eritrossedimentação', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Reticulócitos', synonyms: 'contagem de reticulócitos, reticulocyte count', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Eletroforese de Hemoglobina', synonyms: 'eletroforese Hb, hemoglobin electrophoresis', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Tempo de Coagulação', synonyms: 'TC, coagulation time', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Tempo de Sangramento', synonyms: 'TS, bleeding time', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'TAP', synonyms: 'Tempo de Atividade de Protrombina, TP, INR, protrombina', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'KTTP', synonyms: 'TTPA, tempo de tromboplastina parcial ativada, PTT', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Fibrinogênio', synonyms: 'fibrinogen', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Fator V de Leiden', synonyms: 'fator 5 de Leiden, mutação fator V', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anticoagulante Lúpico', synonyms: 'lupus anticoagulant, LA', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Coombs Direto', synonyms: 'teste de Coombs direto, DAT', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Coombs Indireto', synonyms: 'teste de Coombs indireto, IAT', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Grupo Sanguíneo', synonyms: 'tipagem sanguínea, ABO, Rh, blood type', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Hemocultura', synonyms: 'blood culture, cultura de sangue, bacteremia', categoryName: 'Hematologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },

  // ── BIOQUÍMICA ───────────────────────────────────────────────────────────────
  { name: 'Glicose', synonyms: 'Glicemia, Glicose Pós Prandial, Glicose 60 min, Glicose 120 min, Glicose 17h, glucose, açúcar no sangue', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Hemoglobina Glicada', synonyms: 'HbA1c, A1C, glicohemoglobina', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Curva Glicêmica', synonyms: 'TOTG, teste oral de tolerância à glicose, glucose tolerance test', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 120, price: 0 },
  { name: 'Frutosaminas', synonyms: 'fructosamine, frutosamina', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Insulina', synonyms: 'Insulina Pós Prandial, Insulina Pós Sobrecarga, insulin', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Colesterol Total', synonyms: 'colesterol, total cholesterol', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Colesterol HDL', synonyms: 'HDL, bom colesterol, high density lipoprotein', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Colesterol LDL', synonyms: 'LDL, mau colesterol, low density lipoprotein', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Colesterol VLDL', synonyms: 'VLDL, very low density lipoprotein', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Triglicerídeos', synonyms: 'triglicérides, triglycerides, TG', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Lipoproteína A', synonyms: 'Lp(a), lipoprotein a', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Apolipoproteína A', synonyms: 'ApoA, apolipoprotein A', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Apolipoproteína B', synonyms: 'ApoB, apolipoprotein B', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Creatinina', synonyms: 'creatinine, função renal', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Ureia', synonyms: 'urea, BUN, nitrogênio ureico', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Ácido Úrico', synonyms: 'uric acid, gota', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'TGO', synonyms: 'AST, aspartato aminotransferase, transaminase oxalacética', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'TGP', synonyms: 'ALT, alanina aminotransferase, transaminase pirúvica', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Gama GT', synonyms: 'GGT, gama glutamiltransferase, gamma GT', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Fosfatase Alcalina', synonyms: 'FA, alkaline phosphatase, ALP', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'DHL', synonyms: 'Desidrogenase Lática, LDH, lactate dehydrogenase', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CK', synonyms: 'Creatinofosfoquinase, CPK, creatine kinase', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CKMB', synonyms: 'CK-MB, creatine kinase MB, fração MB', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Troponina', synonyms: 'troponin, troponina I, troponina T', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Bilirrubinas Total e Frações', synonyms: 'bilirrubina total, bilirrubina direta, bilirrubina indireta, bilirubin', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Albumina', synonyms: 'albumin, albumina sérica', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Proteínas Totais', synonyms: 'total proteins, proteínas séricas', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Proteínas Totais e Frações', synonyms: 'proteínas totais e frações, eletroforese de proteínas', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Pré-albumina', synonyms: 'prealbumina, transtiretina, prealbumin', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Mucoproteínas', synonyms: 'mucoprotein, glicoproteínas', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Amilase', synonyms: 'amylase, amilase sérica', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Lipase', synonyms: 'lipase sérica, lipase pancreática', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Aldolase', synonyms: 'aldolase sérica', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Fosforo', synonyms: 'fósforo, phosphorus, fosfato', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Cálcio', synonyms: 'calcium, cálcio sérico', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Cálcio Iônico', synonyms: 'cálcio ionizado, ionized calcium', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Sódio', synonyms: 'sodium, natremia, Na', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Potássio', synonyms: 'potassium, kaliemia, K', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Cloro', synonyms: 'chloride, cloreto, Cl', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Magnésio', synonyms: 'magnesium, Mg', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Ferro', synonyms: 'iron, ferro sérico, sideremia', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Capacidade de Fixação de Ferro', synonyms: 'TIBC, capacidade total de ligação ao ferro', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Transferrina', synonyms: 'transferrin, siderofilina', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Ferritina', synonyms: 'ferritin, ferritina sérica', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Ácido Fólico', synonyms: 'folato, folic acid, vitamina B9', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Vitamina B12', synonyms: 'cobalamina, cyanocobalamin, B12', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Vitamina A', synonyms: 'retinol, vitamin A', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Vitamina C', synonyms: 'Ácido Ascórbico, ascorbic acid, vitamin C', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Vitamina D3 25-OH', synonyms: '25-hidroxivitamina D, calcidiol, vitamin D', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Vitamina D3 1,25-OH', synonyms: '1,25-dihidroxivitamina D, calcitriol', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Vitamina E', synonyms: 'tocoferol, vitamin E, alpha-tocopherol', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Zinco', synonyms: 'zinc, Zn', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Alumínio', synonyms: 'aluminum, Al', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Lítio', synonyms: 'lithium, Li', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Homocisteína', synonyms: 'homocysteine', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Ácido Oxálico', synonyms: 'Oxalato, oxalic acid, oxalate', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'DCE - Clearance de Creatinina', synonyms: 'clearance de creatinina, creatinine clearance, depuração de creatinina', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Prealbumina', synonyms: 'pré-albumina, transtiretina, prealbumin', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Serotonina', synonyms: 'serotonin, 5-HT', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Interleucina 6', synonyms: 'IL-6, interleukin 6', categoryName: 'Bioquímica', preparationInstructions: '', estimatedDuration: 20, price: 0 },

  // ── HORMÔNIOS ────────────────────────────────────────────────────────────────
  { name: 'TSH', synonyms: 'Hormônio Estimulante da Tireoide, thyroid stimulating hormone', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'T3', synonyms: 'triiodotironina, triiodothyronine', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'T3 Livre', synonyms: 'T3 livre, free T3, triiodotironina livre', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'T3 Reverso', synonyms: 'rT3, reverse T3, T3 reverso', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'T4', synonyms: 'tiroxina, thyroxine', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'T4 Livre', synonyms: 'T4 livre, free T4, tiroxina livre', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Tireoglobulina', synonyms: 'thyroglobulin, Tg', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Anti TPO', synonyms: 'anticorpo anti-tireoperoxidase, anti-thyroid peroxidase', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Anti Tireoglobulina', synonyms: 'anticorpo anti-tireoglobulina, anti-Tg', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Calcitonina', synonyms: 'calcitonin', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Paratormônio', synonyms: 'PTH, parathyroid hormone, paratireóide', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Cortisol', synonyms: 'Cortisol 17h, Cortisol 22h, Cortisol 23h, Cortisol Salivar, hydrocortisone', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Curva de Cortisol após ACTH', synonyms: 'teste de estimulação com ACTH, cortisol stimulation test', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 60, price: 0 },
  { name: 'ACTH', synonyms: 'hormônio adrenocorticotrófico, adrenocorticotropic hormone, corticotropina', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Hormônio do Crescimento', synonyms: 'HGH, GH, growth hormone, somatotropina', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Somatomedina-C', synonyms: 'IGF-1, insulin-like growth factor 1, fator de crescimento', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IGFBP-3', synonyms: 'insulin-like growth factor binding protein 3', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'FSH', synonyms: 'hormônio folículo estimulante, follicle stimulating hormone', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'LH', synonyms: 'hormônio luteinizante, luteinizing hormone', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Prolactina', synonyms: 'prolactin, PRL', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Estradiol', synonyms: 'E2, estradiol, estrógeno', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Estrona', synonyms: 'E1, estrone', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Progesterona', synonyms: 'progesterone', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Testosterona', synonyms: 'testosterona total, testosterone', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Testosterona Livre', synonyms: 'free testosterone, testosterona livre', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'DHEA', synonyms: 'deidroepiandrosterona, dehydroepiandrosterone', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'SDHEA', synonyms: 'DHEA-S, sulfato de DHEA, DHEA sulfate', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Androstenediona', synonyms: 'androstenedione', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Di-hidrotestosterona', synonyms: 'DHT, dihydrotestosterone', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'SHBG', synonyms: 'globulina ligadora de hormônios sexuais, sex hormone binding globulin', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Beta HCG', synonyms: 'gonadotrofina coriônica humana, hCG, teste de gravidez quantitativo', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Peptídeo C', synonyms: 'C-peptide, peptídeo C', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Aldosterona', synonyms: 'Angiotensina ECA, aldosterone, renina', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Leptina', synonyms: 'leptin', categoryName: 'Hormônios', preparationInstructions: '', estimatedDuration: 20, price: 0 },

  // ── IMUNOLOGIA E SOROLOGIA ───────────────────────────────────────────────────
  { name: 'PCR - Proteína C Reativa', synonyms: 'CRP, C-reactive protein, PCR quantitativo, PCR alta sensibilidade', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'FAN', synonyms: 'Fator Antinuclear, ANA, antinuclear antibody', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Fator Reumatoide', synonyms: 'FR, rheumatoid factor, fator reumatóide', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'ASLO', synonyms: 'Antiestreptolisina O, ASO, antistreptolysin O', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Waaler Rose', synonyms: 'teste de Waaler-Rose, látex', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Anticorpos Anti-DNA', synonyms: 'anti-DNA hélice simples, anti-DNA hélice dupla, anti-dsDNA, anti-ssDNA', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anticorpos SSA', synonyms: 'anti-Ro, SSA/Ro, anti-SSA', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anticorpos SSB', synonyms: 'anti-La, SSB/La, anti-SSB', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anticorpos Anti Microssomal', synonyms: 'anti-microsomal, anti-LKM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anticorpos Anti Neutrófilos', synonyms: 'ANCA, c-ANCA, p-ANCA, anti-neutrophil cytoplasmic antibody', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anti Beta 2 Glicoproteína I', synonyms: 'anti-beta2-GPI, IgA IgG IgM, anticardiolipina', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anticorpos Anticitrulina', synonyms: 'anti-CCP, anti-peptídeo citrulinado, ACPA', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anticorpos Antitransglutaminase IgA', synonyms: 'anti-tTG IgA, anti-transglutaminase IgA, doença celíaca', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anticorpos Antitransglutaminase IgG', synonyms: 'anti-tTG IgG, anti-transglutaminase IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Anti Endomísio', synonyms: 'EMA, anti-endomysial antibody, IgA IgG IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Gliadina IgA', synonyms: 'anti-gliadina IgA, AGA IgA', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Gliadina IgG', synonyms: 'anti-gliadina IgG, AGA IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Gliadina IgM', synonyms: 'anti-gliadina IgM, AGA IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Cardiolipina IgA', synonyms: 'anticardiolipina IgA, aCL IgA', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Cardiolipina IgG', synonyms: 'anticardiolipina IgG, aCL IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Cardiolipina IgM', synonyms: 'anticardiolipina IgM, aCL IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Complemento C3', synonyms: 'C3, complement C3', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Complemento C4', synonyms: 'C4, complement C4', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Imunoglobulina IgA', synonyms: 'IgA sérica, immunoglobulin A', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Imunoglobulina IgE Total', synonyms: 'IgE total, immunoglobulin E', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Imunoglobulina IgG', synonyms: 'IgG sérica, immunoglobulin G', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Imunoglobulina IgM', synonyms: 'IgM sérica, immunoglobulin M', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Subclasses de IgG', synonyms: 'IgG1, IgG2, IgG3, IgG4, IgG subclasses', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Imunoeletroforese de Proteínas', synonyms: 'imunoeletroforese, immunoelectrophoresis, proteínas séricas', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'HBsAg', synonyms: 'Antígeno de Superfície da Hepatite B, hepatite B, HBsAg', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Anti HBs', synonyms: 'anticorpo anti-HBs, hepatite B anticorpo superfície', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Anti HBc Total', synonyms: 'anticorpo anti-HBc total, hepatite B core total', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Anti HBc IgM', synonyms: 'anticorpo anti-HBc IgM, hepatite B core IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Anti HCV', synonyms: 'anticorpo anti-HCV, hepatite C', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Anti HIV I e II', synonyms: 'HIV, AIDS, anticorpo anti-HIV', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'HTLV I e II', synonyms: 'HTLV, human T-lymphotropic virus', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'VDRL', synonyms: 'sífilis, syphilis, VDRL', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'FTA-ABS IgG', synonyms: 'FTA-ABS, sífilis confirmatório IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'FTA-ABS IgM', synonyms: 'FTA-ABS IgM, sífilis confirmatório IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Toxoplasmose IgG', synonyms: 'toxoplasma IgG, toxoplasmosis IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Toxoplasmose IgM', synonyms: 'toxoplasma IgM, toxoplasmosis IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Rubéola IgG', synonyms: 'rubella IgG, rubéola anticorpo IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Rubéola IgM', synonyms: 'rubella IgM, rubéola anticorpo IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Citomegalovírus IgG', synonyms: 'CMV IgG, cytomegalovirus IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Citomegalovírus IgM', synonyms: 'CMV IgM, cytomegalovirus IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Epstein-Barr IgG', synonyms: 'EBV IgG, mononucleose IgG, Epstein-Barr virus IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Epstein-Barr IgM', synonyms: 'EBV IgM, mononucleose IgM, Epstein-Barr virus IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Parvovírus B19 IgG', synonyms: 'parvovirus B19 IgG, eritema infeccioso IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Parvovírus B19 IgM', synonyms: 'parvovirus B19 IgM, eritema infeccioso IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Chagas IgG', synonyms: 'doença de Chagas IgG, Trypanosoma cruzi IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Chagas IgM', synonyms: 'doença de Chagas IgM, Trypanosoma cruzi IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Chlamydia IgG', synonyms: 'Chlamydia trachomatis IgG, clamídia IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Chlamydia IgM', synonyms: 'Chlamydia trachomatis IgM, clamídia IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Monoteste', synonyms: 'Mononucleose, monospot, heterophile antibody test', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Zika IgG', synonyms: 'Zika vírus IgG, Zika virus IgG', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Zika IgM', synonyms: 'Zika vírus IgM, Zika virus IgM', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'HLA B27', synonyms: 'HLA-B27, antígeno leucocitário humano B27', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'CD4', synonyms: 'linfócitos T CD4, CD4+ T cells', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'CD8', synonyms: 'linfócitos T CD8, CD8+ T cells', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Carga Viral', synonyms: 'viral load, carga viral HIV, carga viral hepatite', categoryName: 'Imunologia e Sorologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },

  // ── MICROBIOLOGIA ────────────────────────────────────────────────────────────
  { name: 'BAAR', synonyms: 'Baciloscopia para BAAR, baciloscopia, tuberculose, AFB smear', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Bacterioscópico', synonyms: 'Gram, coloração de Gram, bacterioscopia', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Micológico Direto', synonyms: 'exame micológico direto, KOH, fungos direto', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Micológico Cultural', synonyms: 'Pesquisa de Fungos, cultura de fungos, fungal culture', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Coprocultura', synonyms: 'stool culture, cultura de fezes, cultura fecal', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Urocultura', synonyms: 'Cultura de Urina com Antibiograma, urine culture, cultura urinária', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Cultura Automatizada', synonyms: 'hemocultura automatizada, automated culture', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Secreção Vaginal - Cultura', synonyms: 'cultura vaginal, vaginal culture, cultura de secreção vaginal', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Antibiograma', synonyms: 'antibiogram, teste de sensibilidade a antibióticos, TSA', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Pesquisa de Streptococcus agalactiae', synonyms: 'Streptococcus do grupo B, GBS, estreptococo grupo B', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Mantoux', synonyms: 'PPD, tuberculin skin test, teste tuberculínico, prova tuberculínica', categoryName: 'Microbiologia', preparationInstructions: '', estimatedDuration: 20, price: 0 },

  // ── URINA E FEZES ────────────────────────────────────────────────────────────
  { name: 'EQU - Exame Comum de Urina', synonyms: 'Urina Tipo I, EAS, urinálise, urinalysis, urina rotina', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Microalbuminúria', synonyms: 'microalbuminuria, albumina urinária, albumin urine', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Parasitológico de Fezes', synonyms: 'EPF, exame parasitológico de fezes, parasitas intestinais', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Coprológico Funcional', synonyms: 'coproló­gico funcional, exame funcional de fezes', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Gordura Fecal Qualitativa', synonyms: 'gordura nas fezes qualitativa, fat in stool qualitative', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Gordura Fecal Quantitativa', synonyms: 'gordura nas fezes quantitativa, fat in stool quantitative, esteatorreia', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Pesquisa de Sangue Oculto nas Fezes', synonyms: 'sangue oculto, fecal occult blood, PSOF', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Pesquisa de Substâncias Redutoras nas Fezes', synonyms: 'substâncias redutoras fezes, reducing substances stool', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Citograma Nasal', synonyms: 'Citológico Diferencial, citograma nasal, nasal cytology', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Teste de Tolerância à Lactose', synonyms: 'intolerância à lactose, lactose tolerance test', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 120, price: 0 },
  { name: 'Citrato - Urina', synonyms: 'citrato urinário, urinary citrate', categoryName: 'Urina e Fezes', preparationInstructions: '', estimatedDuration: 20, price: 0 },

  // ── MARCADORES TUMORAIS ──────────────────────────────────────────────────────
  { name: 'PSA Total', synonyms: 'antígeno prostático específico total, prostate specific antigen', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'PSA Livre', synonyms: 'antígeno prostático específico livre, free PSA', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CEA', synonyms: 'Antígeno Carcinoembrionário, carcinoembryonic antigen', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CA 125', synonyms: 'cancer antigen 125, ovário marcador tumoral', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CA 15-3', synonyms: 'cancer antigen 15-3, mama marcador tumoral', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CA 19-9', synonyms: 'cancer antigen 19-9, pâncreas marcador tumoral', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CA 27.29', synonyms: 'cancer antigen 27.29, CA 27-29', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CA 50', synonyms: 'cancer antigen 50', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CA 72-4', synonyms: 'cancer antigen 72-4, TAG-72', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'CA 242', synonyms: 'cancer antigen 242', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'Alfafetoproteína', synonyms: 'AFP, alpha-fetoprotein, alfafetoproteína', categoryName: 'Marcadores Tumorais', preparationInstructions: '', estimatedDuration: 20, price: 0 },

  // ── GENÉTICA E BIOLOGIA MOLECULAR ────────────────────────────────────────────
  { name: 'Mutação Gene Protrombina', synonyms: 'mutação fator II, prothrombin gene mutation, G20210A', categoryName: 'Genética e Biologia Molecular', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Fator V de Leiden - Genética', synonyms: 'mutação fator V Leiden, Factor V Leiden mutation, R506Q', categoryName: 'Genética e Biologia Molecular', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'MCAD', synonyms: 'deficiência de acil-CoA desidrogenase de cadeia média, medium-chain acyl-CoA dehydrogenase', categoryName: 'Genética e Biologia Molecular', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'Detecção de Chlamydia trachomatis e Neisseria gonorrhoeae por PCR', synonyms: 'PCR Chlamydia gonorreia, clamídia gonorreia PCR, DST PCR', categoryName: 'Genética e Biologia Molecular', preparationInstructions: '', estimatedDuration: 30, price: 0 },
  { name: 'DST por PCR', synonyms: 'Chlamydia Neisseria Mycoplasma Ureaplasma Trichomonas PCR, painel DST molecular', categoryName: 'Genética e Biologia Molecular', preparationInstructions: '', estimatedDuration: 30, price: 0 },

  // ── ALERGOLOGIA (IgE ESPECÍFICO) ─────────────────────────────────────────────
  { name: 'IgE Específico - Leite', synonyms: 'IgE leite, F2, alergia ao leite', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Clara de Ovo', synonyms: 'IgE ovo, F1, alergia ao ovo', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Amendoim', synonyms: 'IgE amendoim, F13, alergia ao amendoim', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Trigo', synonyms: 'IgE trigo, F4, alergia ao trigo, glúten', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Soja', synonyms: 'IgE soja, F14, alergia à soja', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Camarão', synonyms: 'IgE camarão, F24, alergia ao camarão', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Peixe/Bacalhau', synonyms: 'IgE peixe, F3, alergia ao peixe, bacalhau', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Carne Bovina', synonyms: 'IgE carne bovina, F27, alergia à carne', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Tomate', synonyms: 'IgE tomate, F25, alergia ao tomate', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Amendoa', synonyms: 'IgE amêndoa, F20, alergia à amêndoa', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Castanha do Pará', synonyms: 'IgE castanha do pará, F18, alergia à castanha', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Banana', synonyms: 'IgE banana, F92, alergia à banana', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Morango', synonyms: 'IgE morango, F44, alergia ao morango', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Látex', synonyms: 'IgE látex, K82, alergia ao látex', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Caspa de Gato', synonyms: 'IgE gato, E1, alergia ao gato', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Caspa de Cão', synonyms: 'IgE cão, E5, alergia ao cachorro', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Ácaro D. pteronyssinus', synonyms: 'IgE ácaro, D1, Dermatophagoides pteronyssinus', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Ácaro D. farinae', synonyms: 'IgE ácaro, D2, Dermatophagoides farinae', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Blomia tropicalis', synonyms: 'IgE Blomia, D201, ácaro tropical', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Penicilina G', synonyms: 'IgE penicilina, C1, alergia à penicilina', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Amoxicilina', synonyms: 'IgE amoxicilina, C6, alergia à amoxicilina', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - AAS/Aspirina', synonyms: 'IgE aspirina, C217, alergia ao AAS, ácido acetilsalicílico', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Dipirona', synonyms: 'IgE dipirona, C294, alergia à dipirona, metamizol', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Específico - Ibuprofeno', synonyms: 'IgE ibuprofeno, C286, alergia ao ibuprofeno', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Rast Phadiatop', synonyms: 'Phadiatop, painel inalantes, aeroalérgenos', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
  { name: 'IgE Rast Phadiatop Infantil', synonyms: 'Phadiatop Infant, painel pediátrico, alergia infantil', categoryName: 'Alergologia (IgE Específico)', preparationInstructions: '', estimatedDuration: 20, price: 0 },
];

export async function seedExamCatalog() {
  const shouldDestroyConnection = !AppDataSource.isInitialized;

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const categoryRepository = AppDataSource.getRepository(ExamCategory);
  const examCatalogRepository = AppDataSource.getRepository(ExamCatalog);

  // Clear existing data to replace with new catalog
  await examCatalogRepository.createQueryBuilder().delete().execute();
  await categoryRepository.createQueryBuilder().delete().execute();

  // ── Categorias ────────────────────────────────────────────────────────────────
  const categoryMap: Record<string, ExamCategory> = {};

  for (const categoryName of CATEGORIES) {
    let category = await categoryRepository.findOne({ where: { name: categoryName } });

    if (!category) {
      category = categoryRepository.create({ name: categoryName });
      category = await categoryRepository.save(category);
    }

    categoryMap[categoryName] = category;
  }

  console.log(`Categorias de exames: ${Object.keys(categoryMap).length} processadas.`);

  // ── Exames ────────────────────────────────────────────────────────────────────
  let created = 0;
  let skipped = 0;

  for (const examData of EXAMS) {
    const existing = await examCatalogRepository.findOne({ where: { name: examData.name } });

    if (existing) {
      skipped++;
      continue;
    }

    const category = categoryMap[examData.categoryName];

    const exam = examCatalogRepository.create({
      name: examData.name,
      synonyms: examData.synonyms,
      categoryId: category.id,
      preparationInstructions: examData.preparationInstructions,
      estimatedDuration: examData.estimatedDuration,
      price: examData.price,
      isActive: true,
    });

    await examCatalogRepository.save(exam);
    created++;
  }

  console.log('─────────────────────────────────────────────────');
  console.log('Seed do catálogo de exames finalizada com sucesso!');
  console.log(`Exames criados: ${created} | Já existentes (ignorados): ${skipped}`);
  console.log('─────────────────────────────────────────────────');

  if (shouldDestroyConnection && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  seedExamCatalog().catch(async (error) => {
    console.error('Erro ao executar seed do catálogo de exames:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  });
}
