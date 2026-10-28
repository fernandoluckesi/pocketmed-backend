import { z } from 'zod';

/**
 * Hispora's OFFICIAL, versioned contract for AI document extraction.
 *
 * This contract belongs to Hispora, not to the AI vendor — the frontend only
 * ever sees this shape, so the vendor can be swapped without breaking clients
 * (see DocumentProcessingService / the provider adapters).
 *
 * Rules enforced here mirror the spec (archives/docs/ia-use/opea-ia.md):
 *  - Every field is present; unknown values are represented explicitly as
 *    `null` (scalars) or `[]` (lists), never omitted or invented.
 *  - The AI result is always "to be reviewed" — structural validity is NOT
 *    proof of medical accuracy.
 */

export const MEDICAL_DOCUMENT_SCHEMA_VERSION = '1.0';

export const DocumentType = {
  EXAM_GUIDE: 'EXAM_GUIDE',
  PRESCRIPTION: 'PRESCRIPTION',
  UNKNOWN: 'UNKNOWN',
} as const;

export const ExtractionStatus = {
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  UNREADABLE: 'UNREADABLE',
  UNSUPPORTED_DOCUMENT: 'UNSUPPORTED_DOCUMENT',
} as const;

/**
 * The schema the MODEL must fill. It intentionally omits `schemaVersion` — that
 * is stamped by the backend, not the model — and is the exact JSON Schema we
 * hand to the provider for Structured Outputs (all fields required, nullable
 * where a value may be unknown).
 */
export const ModelMedicalDocumentSchema = z.object({
  documentType: z.enum([
    DocumentType.EXAM_GUIDE,
    DocumentType.PRESCRIPTION,
    DocumentType.UNKNOWN,
  ]),
  status: z.enum([
    ExtractionStatus.REVIEW_REQUIRED,
    ExtractionStatus.UNREADABLE,
    ExtractionStatus.UNSUPPORTED_DOCUMENT,
  ]),
  patient: z.object({
    name: z.string().nullable(),
  }),
  prescriber: z.object({
    name: z.string().nullable(),
    crm: z.string().nullable(),
    crmState: z.string().nullable(),
  }),
  exams: z.array(
    z.object({
      originalName: z.string(),
      instructions: z.string().nullable(),
      needsReview: z.boolean(),
    }),
  ),
  medications: z.array(
    z.object({
      originalName: z.string(),
      concentration: z.string().nullable(),
      dosage: z.string().nullable(),
      frequency: z.string().nullable(),
      duration: z.string().nullable(),
      quantity: z.number().nullable(),
      needsReview: z.boolean(),
    }),
  ),
  issuedAt: z.string().nullable(),
  fieldsToReview: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type ModelMedicalDocument = z.infer<typeof ModelMedicalDocumentSchema>;

/**
 * The full public contract returned by the backend: the model output plus the
 * backend-stamped metadata (`schemaVersion`, `operationId`).
 */
export const MedicalDocumentSchema = ModelMedicalDocumentSchema.extend({
  schemaVersion: z.literal(MEDICAL_DOCUMENT_SCHEMA_VERSION),
  operationId: z.string(),
});

export type MedicalDocument = z.infer<typeof MedicalDocumentSchema>;
