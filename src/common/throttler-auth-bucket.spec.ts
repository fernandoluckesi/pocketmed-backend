import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import request from 'supertest';
import { throttlerConfig, THROTTLE_AUTH, THROTTLE_EMAIL } from './throttler.config';

/**
 * Regression guard for audit item #11 (rate limit on login/cadastro/
 * recuperação de senha).
 *
 * `ThrottlerGuard` checks EVERY named throttler registered in
 * `throttlerConfig` against every route it guards, not just the one named in
 * that route's `@Throttle()` — an unmentioned bucket still applies using its
 * own module default. Without `@SkipThrottle()` for the other bucket, a
 * login-shaped route (meant to allow 10/min) would silently also inherit the
 * `email` bucket's far stricter 5-per-hour default and start rejecting real
 * users long before the intended limit. This mirrors the exact decorator
 * pairing used on every route in auth.controller.ts, and includes a stub
 * route without the pairing to prove the bug it prevents is real.
 */
@Controller('test-auth')
class AuthBucketStubController {
  @Post('login-shaped')
  @UseGuards(ThrottlerGuard)
  @Throttle({ [THROTTLE_AUTH]: { ttl: 60_000, limit: 10 } })
  @SkipThrottle({ [THROTTLE_EMAIL]: true })
  @HttpCode(HttpStatus.OK)
  loginShaped() {
    return { ok: true };
  }

  @Post('forgot-password-shaped')
  @UseGuards(ThrottlerGuard)
  @Throttle({ [THROTTLE_EMAIL]: { ttl: 60 * 60_000, limit: 5 } })
  @SkipThrottle({ [THROTTLE_AUTH]: true })
  @HttpCode(HttpStatus.OK)
  forgotPasswordShaped() {
    return { ok: true };
  }

  @Post('login-shaped-no-skip')
  @UseGuards(ThrottlerGuard)
  @Throttle({ [THROTTLE_AUTH]: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  loginShapedNoSkip() {
    return { ok: true };
  }
}

describe('auth/email throttle buckets (regression for #11)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerConfig)],
      controllers: [AuthBucketStubController],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('declares the auth bucket at 10 requests per minute', () => {
    const options = throttlerConfig as { throttlers: Array<{ name?: string }> };
    const bucket = options.throttlers.find((t) => t.name === THROTTLE_AUTH);
    expect(bucket).toMatchObject({ ttl: 60_000, limit: 10 });
  });

  it('allows 10 requests/min on the auth bucket and blocks the 11th', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).post('/test-auth/login-shaped').expect(200);
    }
    await request(app.getHttpServer()).post('/test-auth/login-shaped').expect(429);
  });

  it('allows 5 requests/hour on the email bucket and blocks the 6th', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/test-auth/forgot-password-shaped').expect(200);
    }
    await request(app.getHttpServer()).post('/test-auth/forgot-password-shaped').expect(429);
  });

  it('regression: without @SkipThrottle, the unrelated email bucket silently caps the route at 5', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/test-auth/login-shaped-no-skip').expect(200);
    }
    // The auth bucket alone would allow up to 10/min, but the module-default
    // email bucket (5/hour) also applies to this route because nothing
    // skips it — this is exactly the bug the real routes' @SkipThrottle
    // pairing avoids.
    await request(app.getHttpServer()).post('/test-auth/login-shaped-no-skip').expect(429);
  });
});
