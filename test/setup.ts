/**
 * Global test setup for PocketMed backend integration tests.
 *
 * Uses SQLite in-memory database via better-sqlite3 for fast, isolated tests.
 * Each test file creates its own NestJS application instance.
 */

// Increase timeout for integration tests (DB setup + HTTP requests)
jest.setTimeout(30000);

// Suppress noisy logs during tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests';
process.env.JWT_EXPIRATION = '1h';
process.env.EMAIL_ENABLED = 'false';
process.env.MINIO_ENDPOINT = '';
