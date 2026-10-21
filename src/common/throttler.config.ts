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
 *
 * `auth` is the bucket for credential/code-guessing endpoints: login,
 * registration, and anything that checks a 6-digit verification/reset code
 * (activate-shadow-account, validate-code, reset-password). None of those
 * send an email themselves — the email-sending step that produces the code
 * (forgot-password, send-verification-code, check-shadow) is throttled under
 * `email` instead. 10/min per IP is loose enough for a real user retrying a
 * typo, tight enough to make brute-forcing a 6-digit code (900,000
 * combinations, 15-minute expiry) impractical from a single IP.
 *
 * IMPORTANT: `ThrottlerGuard` checks every named throttler registered here
 * against every route it guards, not just the one named in that route's
 * `@Throttle()` — an unmentioned bucket still applies using ITS OWN module
 * default (e.g. `email`'s 5/hour) unless explicitly turned off with
 * `@SkipThrottle({ <name>: true })`. Every route below pairs `@Throttle()`
 * for the bucket it wants with `@SkipThrottle()` for the other one, so a
 * login endpoint doesn't silently inherit the 5-per-hour email limit.
 */
export const THROTTLE_EMAIL = 'email';
export const THROTTLE_AUTH = 'auth';

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
    {
      name: THROTTLE_AUTH,
      ttl: 60_000, // 1 minute
      limit: 10,
    },
  ],
};
