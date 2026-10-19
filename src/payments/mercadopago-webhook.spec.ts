import { ValidationPipe, ArgumentMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MercadoPagoService } from './mercadopago.service';
import { MercadoPagoWebhookDto } from './dto/mercadopago-webhook.dto';

/**
 * Security coverage for the public Mercado Pago webhook
 * (POST /webhooks/mercadopago).
 *
 * This endpoint is unauthenticated by necessity and can flip a clinic's
 * subscriptionStatus/planId, so the signature check is the only thing
 * standing between the internet and paid-plan state. Asserted here:
 *   - fails closed when the secret is unconfigured (used to fail OPEN);
 *   - rejects forged, tampered and replayed signatures;
 *   - uses a constant-time comparison;
 *   - and, just as important, does NOT reject genuine deliveries — the real
 *     MP payload carries fields this integration ignores, and a 400 there
 *     would trigger MP's every-15-minutes retry loop indefinitely.
 */

const SECRET = 'test-webhook-secret';
const DATA_ID = '999999999';
const REQUEST_ID = 'req-abc-123';

function serviceWith(secret?: string): MercadoPagoService {
  const config = {
    get: (key: string) => {
      if (key === 'MERCADOPAGO_WEBHOOK_SECRET') return secret;
      // Access token absent: these tests never touch the MP API.
      return undefined;
    },
  } as unknown as ConfigService;
  return new MercadoPagoService(config);
}

/** Builds the `x-signature` header exactly as Mercado Pago does. */
function signature(opts: {
  dataId?: string;
  requestId?: string;
  ts?: number;
  secret?: string;
}): string {
  const dataId = opts.dataId ?? DATA_ID;
  const requestId = opts.requestId ?? REQUEST_ID;
  const ts = opts.ts ?? Math.floor(Date.now() / 1000);
  const secret = opts.secret ?? SECRET;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('Mercado Pago webhook — signature verification', () => {
  describe('fails closed', () => {
    it('rejects when MERCADOPAGO_WEBHOOK_SECRET is not configured', () => {
      // Previously returned TRUE here: a deploy that forgot the variable
      // accepted forged notifications from anyone on the internet.
      const service = serviceWith(undefined);
      const result = service.verifyWebhookSignature({
        xSignature: signature({}),
        xRequestId: REQUEST_ID,
        dataId: DATA_ID,
      });
      expect(result).toBe(false);
    });

    it('rejects a missing signature header', () => {
      const service = serviceWith(SECRET);
      expect(service.verifyWebhookSignature({ xRequestId: REQUEST_ID, dataId: DATA_ID })).toBe(
        false,
      );
    });

    it('rejects a missing dataId', () => {
      const service = serviceWith(SECRET);
      expect(
        service.verifyWebhookSignature({
          xSignature: signature({}),
          xRequestId: REQUEST_ID,
        }),
      ).toBe(false);
    });

    it.each([
      ['empty', ''],
      ['garbage', 'not-a-signature'],
      ['missing v1', 'ts=1704908010'],
      ['missing ts', 'v1=abc123'],
      ['malformed pairs', 'ts,v1'],
    ])('rejects a %s signature header', (_label, header) => {
      const service = serviceWith(SECRET);
      expect(
        service.verifyWebhookSignature({
          xSignature: header,
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).toBe(false);
    });
  });

  describe('accepts only genuine signatures', () => {
    it('accepts a correctly signed notification', () => {
      const service = serviceWith(SECRET);
      expect(
        service.verifyWebhookSignature({
          xSignature: signature({}),
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).toBe(true);
    });

    it('rejects a signature produced with the wrong secret', () => {
      const service = serviceWith(SECRET);
      expect(
        service.verifyWebhookSignature({
          xSignature: signature({ secret: 'attacker-secret' }),
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).toBe(false);
    });

    it('rejects a signature bound to a different dataId', () => {
      // Prevents replaying a valid signature against another resource id.
      const service = serviceWith(SECRET);
      expect(
        service.verifyWebhookSignature({
          xSignature: signature({ dataId: '111111111' }),
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).toBe(false);
    });

    it('rejects a signature bound to a different request id', () => {
      const service = serviceWith(SECRET);
      expect(
        service.verifyWebhookSignature({
          xSignature: signature({ requestId: 'other-request' }),
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).toBe(false);
    });

    it('is case-insensitive on dataId, as MP specifies', () => {
      const service = serviceWith(SECRET);
      const hexId = 'ABC123DEF';
      expect(
        service.verifyWebhookSignature({
          xSignature: signature({ dataId: hexId }),
          xRequestId: REQUEST_ID,
          dataId: hexId,
        }),
      ).toBe(true);
    });
  });

  describe('replay protection', () => {
    it('rejects a signature older than the tolerance window', () => {
      // A captured delivery stays cryptographically valid forever; only the
      // timestamp bound makes it unusable later. `ts` is inside the signed
      // manifest, so it can't be retimed without breaking the HMAC.
      const service = serviceWith(SECRET);
      const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
      expect(
        service.verifyWebhookSignature({
          xSignature: signature({ ts: tenMinutesAgo }),
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).toBe(false);
    });

    it('rejects a timestamp far in the future', () => {
      const service = serviceWith(SECRET);
      const tenMinutesAhead = Math.floor(Date.now() / 1000) + 600;
      expect(
        service.verifyWebhookSignature({
          xSignature: signature({ ts: tenMinutesAhead }),
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).toBe(false);
    });

    it('still accepts a delivery within the tolerance window', () => {
      // Guards against over-tightening: MP's own delivery latency and minor
      // clock skew must not reject legitimate traffic.
      const service = serviceWith(SECRET);
      const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120;
      expect(
        service.verifyWebhookSignature({
          xSignature: signature({ ts: twoMinutesAgo }),
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).toBe(true);
    });

    it('rejects a non-numeric timestamp', () => {
      const service = serviceWith(SECRET);
      const manifest = `id:${DATA_ID};request-id:${REQUEST_ID};ts:abc;`;
      const v1 = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
      expect(
        service.verifyWebhookSignature({
          xSignature: `ts=abc,v1=${v1}`,
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).toBe(false);
    });
  });

  describe('timing-safe comparison', () => {
    it('does not throw on a length-mismatched signature', () => {
      // crypto.timingSafeEqual throws on unequal lengths, so the lengths are
      // compared first; a short v1 must be a clean false, not a 500.
      const service = serviceWith(SECRET);
      expect(() =>
        service.verifyWebhookSignature({
          xSignature: 'ts=1704908010,v1=ab',
          xRequestId: REQUEST_ID,
          dataId: DATA_ID,
        }),
      ).not.toThrow();
    });

    it('rejects same-length wrong signatures regardless of matching prefix', () => {
      // A plain `===` on a secret-derived HMAC returns as soon as it hits a
      // differing byte, leaking through timing how many leading bytes were
      // right — on a freely callable endpoint, that's enough to forge a
      // signature byte by byte.
      //
      // The timing itself is too noisy to assert reliably in a unit test, so
      // what's pinned here is the observable invariant that makes the
      // constant-time path meaningful: a near-miss differing only in the
      // last character is rejected exactly like a completely wrong one, and
      // neither throws. (The implementation detail — timingSafeEqual — is
      // visible in mercadopago.service.ts.)
      const service = serviceWith(SECRET);
      const genuine = signature({});
      const v1 = genuine.split('v1=')[1];
      const ts = genuine.split(',')[0];

      // Differs only in the final hex character.
      const lastCharFlipped = v1.slice(0, -1) + (v1.endsWith('a') ? 'b' : 'a');
      // Differs from the very first character.
      const firstCharFlipped = (v1.startsWith('a') ? 'b' : 'a') + v1.slice(1);

      for (const forged of [lastCharFlipped, firstCharFlipped]) {
        expect(forged).toHaveLength(v1.length);
        expect(
          service.verifyWebhookSignature({
            xSignature: `${ts},v1=${forged}`,
            xRequestId: REQUEST_ID,
            dataId: DATA_ID,
          }),
        ).toBe(false);
      }
    });
  });
});

describe('Mercado Pago webhook — payload validation', () => {
  // Mirrors the route-level pipe in payments.controller.ts: strips unknown
  // properties instead of rejecting them (`forbidNonWhitelisted` is NOT set).
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const meta: ArgumentMetadata = {
    type: 'body',
    metatype: MercadoPagoWebhookDto,
    data: undefined,
  };

  it('accepts a real MP payload and drops the fields we ignore', async () => {
    // Verbatim shape from MP's documentation. The extra fields must NOT
    // cause a 400: MP retries any non-2xx every 15 minutes forever, so
    // rejecting genuine deliveries would both storm the endpoint and
    // silently stop applying subscription updates.
    const realPayload = {
      id: 12345,
      live_mode: true,
      type: 'payment',
      date_created: '2015-03-25T10:04:58.396-04:00',
      user_id: 44444,
      api_version: 'v1',
      action: 'payment.created',
      data: { id: '999999999' },
    };

    const result = (await pipe.transform(realPayload, meta)) as MercadoPagoWebhookDto;

    expect(result.type).toBe('payment');
    expect(result.action).toBe('payment.created');
    expect(result.data?.id).toBe('999999999');
    // Undeclared fields are stripped, not fatal.
    expect((result as Record<string, unknown>).live_mode).toBeUndefined();
    expect((result as Record<string, unknown>).user_id).toBeUndefined();
  });

  it('tolerates an unknown field MP might add later', async () => {
    await expect(
      pipe.transform({ type: 'payment', data: { id: DATA_ID }, some_new_field: 'x' }, meta),
    ).resolves.toBeDefined();
  });

  it('coerces a numeric data.id into a string', async () => {
    // The actual crash that the old inline type allowed: a numeric id went
    // straight to `dataId.toLowerCase()` -> TypeError -> unauthenticated 500.
    const result = (await pipe.transform(
      { type: 'payment', data: { id: 123456 } },
      meta,
    )) as MercadoPagoWebhookDto;

    expect(result.data?.id).toBe('123456');
    expect(typeof result.data?.id).toBe('string');
  });

  it.each([
    ['an object', { id: {} }],
    ['an array', { id: [] }],
    ['a path traversal attempt', { id: '../../preapproval/123' }],
    ['a value with a slash', { id: 'abc/def' }],
    ['a value with a dot', { id: 'abc.def' }],
    ['an over-long value', { id: 'a'.repeat(65) }],
  ])('rejects data.id that is %s', async (_label, data) => {
    // data.id is interpolated into an outbound MP API path, so the charset
    // is constrained to what MP actually issues.
    await expect(pipe.transform({ type: 'payment', data }, meta)).rejects.toThrow();
  });

  it('accepts both id shapes MP issues', async () => {
    // Numeric payment ids and hex-ish preapproval ids.
    for (const id of ['999999999', 'abc123def456', 'a1b2-c3d4_e5']) {
      const result = (await pipe.transform(
        { type: 'payment', data: { id } },
        meta,
      )) as MercadoPagoWebhookDto;
      expect(result.data?.id).toBe(id);
    }
  });

  it('accepts a notification with no data at all', async () => {
    // The handler short-circuits to { received: true } when data.id is
    // absent; that path must not 400 either.
    await expect(pipe.transform({ type: 'payment' }, meta)).resolves.toBeDefined();
  });

  it('accepts the legacy topic field', async () => {
    const result = (await pipe.transform(
      { topic: 'preapproval', data: { id: DATA_ID } },
      meta,
    )) as MercadoPagoWebhookDto;
    expect(result.topic).toBe('preapproval');
  });

  it('rejects an over-long event type', async () => {
    await expect(
      pipe.transform({ type: 'x'.repeat(101), data: { id: DATA_ID } }, meta),
    ).rejects.toThrow();
  });
});
