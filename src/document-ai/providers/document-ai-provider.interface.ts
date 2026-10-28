import { ModelMedicalDocument } from '../contracts/medical-document.schema';

export interface DocumentInput {
  /** Raw file bytes. */
  buffer: Buffer;
  /** Real (magic-byte-detected) mime type, e.g. image/png or application/pdf. */
  mimeType: string;
  /** Original filename, used only to build a data-URI name for the provider. */
  filename: string;
}

/**
 * Vendor-agnostic port for AI document extraction. Concrete providers (OpenAI
 * today, another vendor tomorrow) implement this; the domain service depends
 * only on this interface so the public Hispora contract never changes when the
 * vendor does.
 */
export interface DocumentAiProvider {
  /**
   * Extracts the structured fields the model could read. Returns the MODEL
   * portion of the contract (without the backend-stamped schemaVersion /
   * operationId). Implementations must request Structured Outputs so the
   * returned object already matches ModelMedicalDocumentSchema.
   */
  extract(input: DocumentInput): Promise<ModelMedicalDocument>;
}

export const DOCUMENT_AI_PROVIDER = Symbol('DOCUMENT_AI_PROVIDER');
