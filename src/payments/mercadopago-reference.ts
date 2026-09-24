/**
 * A Mercado Pago preapproval carries no product/price catalog reference the
 * way Stripe's Checkout Session metadata does, so the clinic/plan/add-on
 * selection is round-tripped through `external_reference` instead.
 */
export function buildExternalReference(params: {
  clinicId: string;
  planId: string;
  additionalProfessionals: number;
}): string {
  return `${params.clinicId}:${params.planId}:${params.additionalProfessionals}`;
}

export function parseExternalReference(
  reference: string | undefined | null,
): { clinicId: string; planId: string; additionalProfessionals: number } | null {
  if (!reference) return null;
  const [clinicId, planId, additionalProfessionals] = reference.split(':');
  if (!clinicId || !planId) return null;
  return {
    clinicId,
    planId,
    additionalProfessionals: parseInt(additionalProfessionals, 10) || 0,
  };
}
