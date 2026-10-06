import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as reachable by an authenticated user whose email is NOT yet
 * verified. `EmailVerifiedGuard` blocks every other protected route for such
 * users, so this must be placed on exactly the endpoints needed to COMPLETE
 * verification (verify-email, resend code) and to leave/clean up the account
 * (logout, delete). Everything else stays blocked until the email is confirmed.
 */
export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
