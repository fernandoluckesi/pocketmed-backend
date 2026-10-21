import {
  INestApplication,
  ClassSerializerInterceptor,
  ValidationPipe,
  Controller,
  Get,
  Module,
  Res,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import request from 'supertest';

/**
 * Verifies the security headers from item #18 against a real HTTP response,
 * rather than asserting on configuration.
 *
 * The audit called this "zero regression risk", which isn't quite true: the
 * default CSP blocks the inline `<script>` that @nestjs/swagger injects
 * (blank docs page), and the default `Cross-Origin-Resource-Policy:
 * same-origin` interferes with the presigned-R2 redirect that delivers
 * prescriptions by email. Both are pinned below, in both directions: the
 * strict policy applies to the API, the relaxed one only to /api/docs.
 *
 * Mirrors main.ts's helmet setup rather than importing AppModule, which
 * would need a live database. The duplication is the point: if main.ts and
 * this file drift, the assertions below stop describing production — so the
 * setup is kept deliberately small and identical in ordering.
 */

@Controller()
class ProbeController {
  @Get('probe')
  probe() {
    return { ok: true };
  }

  /** Stands in for GET /documents/access/:token, which 302s to a presigned
   * Cloudflare R2 URL on another origin. */
  @Get('probe-redirect')
  redirect(@Res() res: Response) {
    res.redirect(302, 'https://example-bucket.r2.cloudflarestorage.com/doc.pdf?sig=abc');
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('Security headers (item #18)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();

    // ─── identical to main.ts ───
    const swaggerPathPrefixes = ['/api/docs'];
    const isSwaggerPath = (url: string) =>
      swaggerPathPrefixes.some((prefix) => url.split('?')[0].startsWith(prefix));

    const sharedHelmetOptions = {
      crossOriginResourcePolicy: { policy: 'cross-origin' as const },
    };
    const apiHelmet = helmet(sharedHelmetOptions);
    const swaggerHelmet = helmet({
      ...sharedHelmetOptions,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });

    app.use((req: Request, res: Response, next: NextFunction) =>
      isSwaggerPath(req.originalUrl || req.url)
        ? swaggerHelmet(req, res, next)
        : apiHelmet(req, res, next),
    );
    app.enableCors();
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Hispora API').setVersion('1.0').build(),
    );
    SwaggerModule.setup('api/docs', app, document);
    // ─── end ───

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('API responses', () => {
    it('sets the core protective headers', async () => {
      const res = await request(app.getHttpServer()).get('/probe').expect(200);

      // Stops MIME sniffing — a stored file served with the wrong
      // Content-Type can't be reinterpreted as script.
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      // Blocks clickjacking of any HTML this app returns (error pages).
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      // Health data in a URL must never leak to a third-party site.
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    });

    it('enforces HTTPS for a year via HSTS, without preload', async () => {
      const res = await request(app.getHttpServer()).get('/probe').expect(200);
      const hsts = res.headers['strict-transport-security'];

      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      // `preload` is an irreversible, domain-wide commitment; it must be an
      // explicit decision, never inherited from a default.
      expect(hsts).not.toContain('preload');
    });

    it('stops advertising the server technology', async () => {
      const res = await request(app.getHttpServer()).get('/probe').expect(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('applies a strict CSP to API routes', async () => {
      const res = await request(app.getHttpServer()).get('/probe').expect(200);
      const csp = res.headers['content-security-policy'];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'self'");
      // The API must NOT inherit the Swagger relaxation.
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toMatch(/script-src [^;]*unsafe-inline/);
    });

    it('allows cross-origin resources, so presigned R2 links keep working', async () => {
      // The regression this guards: with the default `same-origin`, the
      // browser refuses the redirected R2 response and the emailed
      // prescription/exam links break.
      const res = await request(app.getHttpServer()).get('/probe').expect(200);
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('keeps the headers on an error response', async () => {
      // Registering helmet before the routes means even a 404 is covered;
      // an unhandled path shouldn't be a gap.
      const res = await request(app.getHttpServer()).get('/does-not-exist').expect(404);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('keeps the headers on the document redirect', async () => {
      const res = await request(app.getHttpServer()).get('/probe-redirect').expect(302);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(res.headers.location).toContain('r2.cloudflarestorage.com');
    });
  });

  describe('Swagger UI', () => {
    it('renders with its inline script allowed', async () => {
      // The concrete failure the audit asked to check: under the default
      // `script-src 'self'`, @nestjs/swagger's injected inline <script> is
      // blocked and the docs page comes up blank.
      const res = await request(app.getHttpServer()).get('/api/docs').expect(200);
      const csp = res.headers['content-security-policy'];

      expect(csp).toMatch(/script-src [^;]*'unsafe-inline'/);
      expect(res.text).toContain('<script');
    });

    it('still gets the non-CSP protections on the docs route', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('serves the OpenAPI JSON', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
      expect(res.body.openapi || res.body.swagger).toBeDefined();
    });
  });
});
