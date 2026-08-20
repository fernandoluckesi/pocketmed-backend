import { AsyncLocalStorage } from 'async_hooks';
import { AuditRequestContext } from './audit.types';

/**
 * AsyncLocalStorage-based request context propagation.
 * REQ-AUD-034 — makes request metadata available throughout the entire request lifecycle
 * without passing it manually through every function call.
 */
export const requestContextStorage = new AsyncLocalStorage<AuditRequestContext>();

/**
 * Get the current request context from AsyncLocalStorage.
 * Returns undefined if called outside a request scope.
 */
export function getRequestContext(): AuditRequestContext | undefined {
  return requestContextStorage.getStore();
}
