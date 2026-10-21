import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { UploadService } from './upload/upload.service';
import { PresignDocumentUrlsInterceptor } from './upload/presign-document-urls.interceptor';

async function bootstrap() {
  // rawBody: true lets webhook handlers (Stripe) verify signatures against
  // the exact bytes received, before Nest's JSON body parser touches them.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Railway terminates TLS and proxies to the app, so without this every
  // request reports the proxy's IP. Rate limiting keyed on `req.ip` would
  // then put all users in one bucket — one abuser would lock out everyone,
  // and a single client could spread its requests across none.
  //
  // `1` (not `true`) on purpose: trusting the whole chain would let a client
  // forge `X-Forwarded-For` and get a fresh bucket per request, defeating the
  // limit entirely. One hop = only the proxy we actually run behind.
  app.set('trust proxy', 1);

  // ── Security headers (helmet) ─────────────────────────────────────────────
  // Registered before everything else so even a 404 or a thrown error
  // carries the headers.
  //
  // Two instances, because the default CSP is right for an API but breaks
  // the Swagger UI page. They are mutually exclusive by path rather than
  // chained: helmet SETS headers (it doesn't merge), so running a second
  // instance after the first would simply overwrite the relaxed CSP with
  // the strict one and leave the docs page broken.
  const swaggerPathPrefixes = ['/api/docs'];
  const isSwaggerPath = (url: string) =>
    swaggerPathPrefixes.some((prefix) => url.split('?')[0].startsWith(prefix));

  // Shared non-CSP options, so both instances protect equally and only the
  // content policy differs.
  //
  // Cross-Origin-Resource-Policy is relaxed from the default `same-origin`
  // to `cross-origin`: GET /documents/access/:token redirects (302) to a
  // presigned Cloudflare R2 URL, and the clients also render presigned
  // document/profile-image URLs from that other origin. Keeping
  // `same-origin` would make the browser refuse those responses — breaking
  // exactly the prescription/exam links delivered by email (see
  // document-access.controller.ts).
  //
  // HSTS stays ON (default: 1 year, includeSubDomains) since Railway
  // terminates TLS and every real deployment is HTTPS-only. Deliberately
  // NOT `preload`ed: that is an irreversible, domain-wide commitment and
  // should be an explicit decision, not an inherited default.
  const sharedHelmetOptions = {
    crossOriginResourcePolicy: { policy: 'cross-origin' as const },
  };

  // Strict policy for the API itself. It serves JSON and 302s, never HTML a
  // browser renders, so `default-src 'self'` costs nothing here.
  const apiHelmet = helmet(sharedHelmetOptions);

  // Relaxed policy for the docs page only. @nestjs/swagger injects its init
  // code as an inline `<script>` (see dist/swagger-ui/swagger-ui.js), which
  // the default `script-src 'self'` blocks outright — the page renders
  // blank. `'unsafe-inline'` is a scoped trade-off: the page displays no
  // user-controlled data, so there is nothing for an injected script to
  // steal, and the API keeps the strict policy.
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

  // Last line of defense against password hashes / verification codes
  // leaking through an entity loaded via an un-`select`ed relation (e.g.
  // `relations: ['doctor', 'patient']` on a certificate/exam/appointment):
  // `@Exclude()` on those columns (see entities/*.entity.ts) is honored on
  // every response, nested relations included, regardless of which service
  // method loaded them.
  //
  // PresignDocumentUrlsInterceptor is registered FIRST (outermost), so in
  // the response pipeline it runs AFTER ClassSerializerInterceptor — it only
  // ever sees the already-plain, already-@Exclude()'d object, never a raw
  // entity instance. It rewrites every documentUrl/fileUrl/resultFile(s) it
  // finds (at any nesting depth) from the permanent bucket link stored in
  // the DB into a short-lived signed one, since the bucket's public read
  // access was disabled in October 2026 (see upload.service.ts).
  app.useGlobalInterceptors(
    new PresignDocumentUrlsInterceptor(app.get(UploadService)),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Hispora API')
    .setDescription('API para gerenciamento de histórico médico')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Typed explicitly: with the app now generic over NestExpressApplication,
  // the adapter's handler args are no longer inferred as Express types.
  app.getHttpAdapter().get('/api/docs-json', (_req: Request, res: Response) => {
    res.json(document);
  });

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger documentation available at: ${await app.getUrl()}/api/docs`);
  console.log(`Swagger JSON available at: ${await app.getUrl()}/api/docs-json`);
}
bootstrap();
