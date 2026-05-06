import { z } from "zod";

const TraitLevelSchema = z.object({
  value: z.enum(["low", "medium", "high"]),
  evidence: z.string().min(1).max(500),
});

const TraitFreeformSchema = z.object({
  value: z.string().min(1).max(200),
  evidence: z.string().min(1).max(500),
});

const TraitsSchema = z.object({
  formality: TraitLevelSchema,
  empathy: TraitLevelSchema,
  assertiveness: TraitLevelSchema,
  length_preference: z.object({
    value: z.enum(["short", "medium", "long"]),
    evidence: z.string().min(1).max(500),
  }),
  tone_signals: TraitFreeformSchema,
  writing_quirks: TraitFreeformSchema,
});

const MetadataSchema = z.object({
  school_name: z.string().nullable(),
  grade: z.number().int().min(1).max(6).nullable(),
  class_number: z.number().int().min(1).max(20).nullable(),
  import_format: z.enum(["hitalk", "kakaotalk", "freeform"]),
});

const PersonaSchema = z.object({
  relationship_type: z.enum(["parent", "colleague", "external"]).nullable(),
  student_label: z.string().nullable(),
  speaker_mixed: z.boolean(),
  speaker_classification_note: z.string().nullable(),
  traits: TraitsSchema,
});

// 거부 응답 스키마 (신규)
export const RejectedResponseSchema = z.object({
  rejected: z.literal(true),
  reason: z.string().min(1).max(500),
});

// 정상 추출 응답 스키마
export const SuccessfulExtractResponseSchema = z.object({
  anonymized_conversation: z.string().min(1),
  metadata: MetadataSchema,
  persona: PersonaSchema,
});

// LLM 응답 통합 스키마 (둘 중 하나)
export const ExtractLLMResponseSchema = z.union([
  RejectedResponseSchema,
  SuccessfulExtractResponseSchema,
]);

// API 라우트 응답 스키마 (DB 저장 후 persona_id 포함)
export const ExtractAPIResponseSchema = z.object({
  persona_id: z.string().uuid(),
  anonymized_conversation: z.string().min(1),
  metadata: MetadataSchema,
  persona: PersonaSchema,
});

export type RejectedResponse = z.infer<typeof RejectedResponseSchema>;
export type SuccessfulExtractResponse = z.infer<typeof SuccessfulExtractResponseSchema>;
export type ExtractLLMResponse = z.infer<typeof ExtractLLMResponseSchema>;
export type ExtractAPIResponse = z.infer<typeof ExtractAPIResponseSchema>;

// 기존 호환성 alias
export type ExtractResponse = SuccessfulExtractResponse;
export const ExtractResponseSchema = SuccessfulExtractResponseSchema;
