/**
 * The 5 fixed subscription plans a clinic can be on. Fixed business-defined
 * tiers, not a database table — a clinic just stores which `id` it's on
 * (Clinic.planId) plus how many extra professional seats it bought
 * (Clinic.additionalProfessionals).
 *
 * Pricing model: "capacity + features" per clinic (not per-doctor pricing —
 * a clinic with 2 doctors and one with 30 don't pay the same, but adding one
 * more doctor doesn't necessarily force a whole-tier upgrade either, thanks
 * to the per-professional add-on).
 */

export interface PlanFeatures {
  agenda: boolean;
  prontuario: boolean;
  examesDocumentos: boolean;
  dependentes: boolean;
  secretaria: boolean;
  gestaoClinica: boolean;
  financeiro: boolean;
  ocrIa: boolean;
  relatoriosAvancados: boolean;
  auditoriaAvancada: boolean;
  integracoesApi: boolean;
  suportePrioritario: boolean;
}

export interface Plan {
  id: string;
  name: string;
  /** Monthly price in BRL. `null` means "custom" (Enterprise — negotiated). */
  price: number | null;
  description: string;
  /** Professionals (doctors) included before the per-seat add-on applies. `null` = unbounded (Enterprise). */
  professionalsIncluded: number | null;
  /** "Active" patients included — one who had a visit/update/interaction with the clinic in the last 12 months. `null` = unbounded (Enterprise). */
  activePatientsIncluded: number | null;
  /** BRL/month per extra professional beyond `professionalsIncluded`. `null` = negotiated (Premium/Enterprise). */
  additionalProfessionalPrice: number | null;
  /** BRL/month per extra 1,000 active patients beyond `activePatientsIncluded`. `null` = negotiated/not applicable (Enterprise). */
  additionalPatientsPer1000Price: number | null;
  highlighted?: boolean;
  features: PlanFeatures;
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Hispora Starter',
    price: 149,
    description: 'Para consultórios pequenos.',
    professionalsIncluded: 2,
    activePatientsIncluded: 500,
    additionalProfessionalPrice: 79,
    additionalPatientsPer1000Price: 50,
    features: {
      agenda: true,
      prontuario: true,
      examesDocumentos: true,
      dependentes: false,
      secretaria: false,
      gestaoClinica: false,
      financeiro: false,
      ocrIa: false,
      relatoriosAvancados: false,
      auditoriaAvancada: false,
      integracoesApi: false,
      suportePrioritario: false,
    },
  },
  {
    id: 'plus',
    name: 'Hispora Plus',
    price: 299,
    description: 'Para consultórios em crescimento. O plano principal da Hispora.',
    professionalsIncluded: 5,
    activePatientsIncluded: 2000,
    additionalProfessionalPrice: 69,
    additionalPatientsPer1000Price: 50,
    highlighted: true,
    features: {
      agenda: true,
      prontuario: true,
      examesDocumentos: true,
      dependentes: true,
      secretaria: true,
      gestaoClinica: true,
      financeiro: false,
      ocrIa: false,
      relatoriosAvancados: false,
      auditoriaAvancada: false,
      integracoesApi: false,
      suportePrioritario: false,
    },
  },
  {
    id: 'pro',
    name: 'Hispora Pro',
    price: 599,
    description: 'Para clínicas médias.',
    professionalsIncluded: 10,
    activePatientsIncluded: 5000,
    additionalProfessionalPrice: 59,
    additionalPatientsPer1000Price: 50,
    features: {
      agenda: true,
      prontuario: true,
      examesDocumentos: true,
      dependentes: true,
      secretaria: true,
      gestaoClinica: true,
      financeiro: true,
      ocrIa: true,
      relatoriosAvancados: true,
      auditoriaAvancada: false,
      integracoesApi: false,
      suportePrioritario: true,
    },
  },
  {
    id: 'premium',
    name: 'Hispora Premium',
    price: 999,
    description: 'Para clínicas maiores.',
    professionalsIncluded: 25,
    activePatientsIncluded: 15000,
    additionalProfessionalPrice: null,
    additionalPatientsPer1000Price: 50,
    features: {
      agenda: true,
      prontuario: true,
      examesDocumentos: true,
      dependentes: true,
      secretaria: true,
      gestaoClinica: true,
      financeiro: true,
      ocrIa: true,
      relatoriosAvancados: true,
      auditoriaAvancada: true,
      integracoesApi: true,
      suportePrioritario: true,
    },
  },
  {
    id: 'enterprise',
    name: 'Hispora Enterprise',
    price: null,
    description:
      'Para clínicas grandes, grupos médicos, redes, hospitais e operações com milhares de pacientes. Preço personalizado.',
    professionalsIncluded: null,
    activePatientsIncluded: null,
    additionalProfessionalPrice: null,
    additionalPatientsPer1000Price: null,
    features: {
      agenda: true,
      prontuario: true,
      examesDocumentos: true,
      dependentes: true,
      secretaria: true,
      gestaoClinica: true,
      financeiro: true,
      ocrIa: true,
      relatoriosAvancados: true,
      auditoriaAvancada: true,
      integracoesApi: true,
      suportePrioritario: true,
    },
  },
];

export function getPlan(planId: string): Plan {
  return PLANS.find((p) => p.id === planId) || PLANS[0];
}
