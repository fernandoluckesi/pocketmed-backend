import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsObject,
  ValidateNested,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Body of a Mercado Pago webhook notification.
 *
 * This endpoint is `@Public()` — reachable by anyone on the internet — and
 * previously took `@Body() body: { type?: string; ... }`, an inline TS type
 * that produces no runtime validation whatsoever. The concrete consequence:
 * `data.id` was assumed to be a string and passed to `dataId.toLowerCase()`,
 * so `{"data":{"id":123}}` (plausible: MP payment ids are numeric) or
 * `{"data":{"id":{}}}` threw a TypeError — an unauthenticated 500 with a
 * stack trace for anyone probing the endpoint.
 *
 * Only the fields this integration actually reads are declared. A real MP
 * delivery carries more (`id`, `live_mode`, `date_created`, `user_id`,
 * `api_version`); those are intentionally dropped rather than declared —
 * see the route-level ValidationPipe in payments.controller.ts, which
 * strips unknown properties instead of rejecting them. Nothing from this
 * body is ever persisted: the handler only uses `data.id` to re-fetch
 * authoritative state from the Mercado Pago API, which is what MP itself
 * recommends.
 *
 * Payload reference:
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
class MercadoPagoWebhookDataDto {
  /**
   * Resource id the notification refers to (payment id or preapproval id).
   *
   * MP sends payment ids as digit strings and preapproval ids as hex-ish
   * strings, so both shapes must pass. `@Type(() => String)` normalizes a
   * JSON number into a string *before* validation, which is what turns the
   * numeric form into a valid request instead of a 500 downstream.
   *
   * Charset restricted to what MP actually uses (alphanumerics, dash,
   * underscore): this value is interpolated into an outbound Mercado Pago
   * API path by `getSubscription`/`getPayment`, so blocking slashes, dots
   * and separators keeps a crafted id from altering that request's meaning.
   */
  @ApiPropertyOptional({ example: '999999999' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'data.id must contain only alphanumerics, dashes or underscores',
  })
  id?: string;
}

export class MercadoPagoWebhookDto {
  /**
   * Event kind. MP uses `type` on current deliveries and `topic` on older
   * ones, and the same subscription event arrives under different names
   * depending on dashboard configuration — both are accepted and normalized
   * by the handler.
   *
   * Deliberately NOT an `@IsIn([...])` whitelist: the controller already
   * routes unrecognized events to a logged no-op by design, since the
   * dashboard may be subscribed to topics this integration doesn't handle.
   * Rejecting them here would convert that benign case into a 400 that MP
   * retries every 15 minutes.
   */
  @ApiPropertyOptional({ example: 'payment' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ example: 'preapproval', description: 'Formato legado de `type`.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  topic?: string;

  @ApiPropertyOptional({ example: 'payment.created' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ type: MercadoPagoWebhookDataDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MercadoPagoWebhookDataDto)
  data?: MercadoPagoWebhookDataDto;
}
