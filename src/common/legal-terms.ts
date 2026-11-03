/**
 * Version of the Terms of Use / Privacy Policy currently in force.
 *
 * Stored alongside the acceptance timestamp so we can later answer "which
 * text did this user actually agree to?" — the documents live in the
 * frontend bundle, not in the database, so a date-based version is what
 * identifies them.
 *
 * **Bump this whenever the legal text changes materially.** The last change
 * was 22/10/2026 (refund policy, subprocessors, international transfer,
 * minors' data, clinical-content liability, CFM retention).
 */
export const CURRENT_TERMS_VERSION = '2026-10';
