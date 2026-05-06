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

export const ExtractResponseSchema = z.object({
  anonymized_conversation: z.string().min(1),
  metadata: MetadataSchema,
  persona: PersonaSchema,
});

export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;

// Step 7에서 docs B 6.1 본문대로 재구성 시 흡수 예정 (의존성 가교)
export type SuccessfulExtractResponse = ExtractResponse;
