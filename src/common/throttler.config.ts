import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Rate-limit buckets.
 *
 * `default` is permissive on purpose: the throttler is NOT registered as a
 * global guard, so nothing is limited unless a route opts in with
 * `@UseGuards(ThrottlerGuard)`. Turning it on globally would change the
 * behaviour of every endpoint at once — including authenticated clinical
 * routes a doctor may legitimately hit in bursts — which is not something to
 * do in the same change that adds the mechanism.
 *
 * `email` is the strict bucket for unauthenticated endpoints that cause an
 * email to be sent. Those are the real abuse vector: anyone can trigger
 * outbound mail to an arbitrary address, which burns sending reputation on
 * the shared domain even though no data leaks.
 */
export const THROTTLE_EMAIL = 'email';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'default',
      ttl: 60_000,
      limit: 120,
    },
    {
      name: THROTTLE_EMAIL,
      ttl: 60 * 60_000, // 1 hour
      limit: 5,
    },
  ],
};
