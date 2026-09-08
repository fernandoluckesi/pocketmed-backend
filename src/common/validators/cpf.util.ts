/**
 * CPF utilities: normalization and full validation (check digits).
 *
 * CPF is a personal identifier. These helpers are used to validate input on
 * the backend (so an invalid CPF can never be persisted, even bypassing the
 * frontend) and to normalize it to the canonical 11-digit form for storage.
 */

/** Strips any non-digit characters, returning only the digits. */
export function normalizeCpf(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Validates a CPF by its check digits (dígitos verificadores).
 * Accepts values with or without mask; validation is done on the digits.
 * Rejects: wrong length, all-equal digits (e.g. 00000000000), and any value
 * whose check digits don't match.
 */
export function isValidCpf(value: string | null | undefined): boolean {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11) return false;

  // Reject known-invalid sequences of repeated digits.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map((d) => parseInt(d, 10));

  // First check digit.
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  let firstCheck = (sum * 10) % 11;
  if (firstCheck === 10) firstCheck = 0;
  if (firstCheck !== digits[9]) return false;

  // Second check digit.
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  let secondCheck = (sum * 10) % 11;
  if (secondCheck === 10) secondCheck = 0;
  if (secondCheck !== digits[10]) return false;

  return true;
}
