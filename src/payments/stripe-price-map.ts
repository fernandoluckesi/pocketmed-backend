/**
 * Maps a plan id to the env var that holds its Stripe recurring Price id.
 * Kept separate from `plans.config.ts` (a static, DB-free business config)
 * because Stripe price ids are environment-specific (test/live) secrets,
 * not product data — they belong in env vars, not in source.
 *
 * Enterprise has no self-serve price (negotiated, no checkout) so it's
 * intentionally absent here.
 */
const PLAN_PRICE_ENV_VAR: Record<string, string> = {
  starter: 'STRIPE_PRICE_STARTER',
  plus: 'STRIPE_PRICE_PLUS',
  pro: 'STRIPE_PRICE_PRO',
  premium: 'STRIPE_PRICE_PREMIUM',
};

/** Same idea for the per-extra-professional add-on price, where offered. */
const PLAN_ADDON_PRICE_ENV_VAR: Record<string, string> = {
  starter: 'STRIPE_PRICE_ADDON_STARTER',
  plus: 'STRIPE_PRICE_ADDON_PLUS',
  pro: 'STRIPE_PRICE_ADDON_PRO',
};

export function getPlanPriceEnvVar(planId: string): string | null {
  return PLAN_PRICE_ENV_VAR[planId] || null;
}

export function getAddonPriceEnvVar(planId: string): string | null {
  return PLAN_ADDON_PRICE_ENV_VAR[planId] || null;
}

/** Reverse lookup: which plan id does a Stripe Price id belong to?
 * Used to sync a plan change made from the Stripe billing portal back
 * into our own `Clinic.planId`. */
export function planIdForStripePrice(priceId: string): string | null {
  for (const [planId, envVar] of Object.entries(PLAN_PRICE_ENV_VAR)) {
    if (process.env[envVar] === priceId) return planId;
  }
  return null;
}
