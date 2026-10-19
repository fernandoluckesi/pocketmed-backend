import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { UploadService } from './upload.service';

/** Field names ever used to store a permanent object-storage link (see
 * entities across the codebase — Prescription/ExamRequest/Report.documentUrl,
 * Report/Certificate/MedicalAttachment.fileUrl, Exam.resultFile(s),
 * ExamSchedule.resultFileUrl). Kept as a flat list rather than per-entity
 * typing since this runs generically over whatever shape a controller
 * returns. */
const URL_FIELD_NAMES = new Set(['documentUrl', 'fileUrl', 'resultFileUrl', 'resultFile']);
const URL_ARRAY_FIELD_NAMES = new Set(['resultFiles']);

/** Matches the last mile of every leak this interceptor closed in October
 * 2026: a controller returning an entity (or array/nested relation of one)
 * with one of the field names above still holding the PERMANENT bucket URL
 * instead of a link that actually resolves now that the bucket's public
 * read access is disabled.
 *
 * Runs as the LAST global interceptor (registered first in main.ts, so it
 * is outermost and therefore transforms the response AFTER
 * ClassSerializerInterceptor has already applied every entity's @Exclude()
 * — this walks plain, already-sanitized objects, never a raw entity
 * instance, so it can never interfere with password/code exclusion.
 *
 * Fields literally named `url` (e.g. the dedicated `{ url }` responses from
 * prescriptions/:id/pdf, documents/access/:token, etc.) are deliberately
 * left alone — those are already freshly-signed by their own handler. */
@Injectable()
export class PresignDocumentUrlsInterceptor implements NestInterceptor {
  constructor(private readonly uploadService: UploadService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(mergeMap((data) => from(this.transform(data, 0, new Set()))));
  }

  private async transform(data: any, depth: number, seen: Set<any>): Promise<any> {
    if (data === null || data === undefined || depth > 8) return data;

    if (Array.isArray(data)) {
      return Promise.all(data.map((item) => this.transform(item, depth + 1, seen)));
    }

    if (data instanceof Date || data instanceof Buffer) return data;

    if (typeof data === 'object') {
      if (seen.has(data)) return data; // circular reference guard
      seen.add(data);

      for (const key of Object.keys(data)) {
        const value = data[key];

        if (URL_FIELD_NAMES.has(key) && typeof value === 'string' && value) {
          data[key] = (await this.presign(value)) ?? value;
          continue;
        }

        if (URL_ARRAY_FIELD_NAMES.has(key) && Array.isArray(value)) {
          data[key] = await Promise.all(
            value.map(async (item: unknown) =>
              typeof item === 'string' && item ? ((await this.presign(item)) ?? item) : item,
            ),
          );
          continue;
        }

        if (value && typeof value === 'object') {
          data[key] = await this.transform(value, depth + 1, seen);
        }
      }

      return data;
    }

    return data;
  }

  private async presign(storedUrl: string): Promise<string | null> {
    try {
      // 15 minutes: generous enough to cover "load a list, then tap an item
      // minutes later" without making these links meaningfully different
      // from the permanent ones they replace, security-wise.
      return await this.uploadService.getPresignedUrl(storedUrl, 900);
    } catch {
      return null;
    }
  }
}
