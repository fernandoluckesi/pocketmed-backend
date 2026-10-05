import { SignatureStatus } from './signature/signature.types';

/**
 * Storage prefixes for generated medical documents, kept in one place so
 * every document-producing feature lands in a predictable bucket path.
 * `medicalDocuments` is the catch-all for future types (atestados, exam
 * requests) that don't warrant their own prefix.
 */
export const DOCUMENT_FOLDERS = {
  prescriptions: 'prescriptions',
  reports: 'reports',
  examRequests: 'exam-requests',
  medicalDocuments: 'medical-documents',
} as const;

/** Lifecycle of any signable medical document (prescription, report, ...).
 * `SIGNED` may only be reached once `signatureStatus === SignatureStatus.SIGNED`
 * — enforced in each feature service, never set directly from user input. */
export enum DocumentStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  /** Delivered to the patient without a digital signature. Only reachable
   * from GENERATED — a document that was signed goes straight to SIGNED
   * instead (signing implies delivery in this flow). */
  SENT = 'sent',
  SIGNED = 'signed',
  CANCELED = 'canceled',
}

/** A ProseMirror document (Tiptap's native JSON shape) — opaque to the
 * backend beyond what `prosemirror-to-pdfkit` walks. Kept as `any`-shaped
 * (via a minimal structural type) since the frontend owns the real schema. */
export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export type ProseMirrorDoc = ProseMirrorNode;

export type DocumentSection =
  | {
      kind: 'key-values';
      heading?: string;
      items: Array<{ label: string; value: string }>;
    }
  | {
      kind: 'rich-text';
      heading: string;
      content: ProseMirrorDoc | null;
    }
  | {
      kind: 'plain-text';
      heading?: string;
      text: string;
    };

export interface MedicalDocumentSpec {
  documentType: 'prescription' | 'report' | 'exam';
  title: string;
  doctor: {
    name: string;
    crm: string;
    specialty?: string | null;
  };
  patient: {
    name: string;
    cpf?: string | null;
    birthDate?: Date | null;
    gender?: string | null;
  };
  issueDate: Date;
  sections: DocumentSection[];
  signatureStatus: SignatureStatus;
}
