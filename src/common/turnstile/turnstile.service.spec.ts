import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let httpService: { post: jest.Mock };

  async function buildService(secretKey: string | undefined) {
    httpService = { post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnstileService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: { get: jest.fn(() => secretKey) } },
      ],
    }).compile();

    return module.get(TurnstileService);
  }

  it('skips verification entirely when TURNSTILE_SECRET_KEY is not set', async () => {
    const service = await buildService(undefined);

    await expect(service.verify(undefined)).resolves.toBeUndefined();
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('passes when Cloudflare reports success', async () => {
    const service = await buildService('secret-key');
    httpService.post.mockReturnValue(of({ data: { success: true } }));

    await expect(service.verify('a-valid-token')).resolves.toBeUndefined();
    expect(httpService.post).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.any(URLSearchParams),
    );
  });

  it('includes the remote IP in the verification request when provided', async () => {
    const service = await buildService('secret-key');
    httpService.post.mockReturnValue(of({ data: { success: true } }));

    await service.verify('a-valid-token', '203.0.113.5');

    const [, params] = httpService.post.mock.calls[0];
    expect((params as URLSearchParams).get('remoteip')).toBe('203.0.113.5');
  });

  it('throws 400 when the token is missing but the secret key is configured', async () => {
    const service = await buildService('secret-key');

    await expect(service.verify(undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('throws 400 when Cloudflare reports failure', async () => {
    const service = await buildService('secret-key');
    httpService.post.mockReturnValue(
      of({ data: { success: false, 'error-codes': ['invalid-input-response'] } }),
    );

    await expect(service.verify('a-bad-token')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails open (does not throw) when the Cloudflare API call itself errors', async () => {
    const service = await buildService('secret-key');
    httpService.post.mockReturnValue(throwError(() => new Error('network timeout')));

    await expect(service.verify('a-valid-token')).resolves.toBeUndefined();
  });
});
