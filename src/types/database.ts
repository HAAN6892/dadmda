// personas 테이블 Row 타입
export interface PersonaRow {
  id: string;
  user_id: string;
  name: string | null;
  student_label: string | null;
  relationship_type: "parent" | "colleague" | "external" | null;
  speaker_mixed: boolean;
  speaker_classification_note: string | null;
  traits: PersonaTraits;
  metadata: PersonaMetadata;
  anonymized_conversation: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PersonaTraits {
  formality: { value: "low" | "medium" | "high"; evidence: string };
  empathy: { value: "low" | "medium" | "high"; evidence: string };
  assertiveness: { value: "low" | "medium" | "high"; evidence: string };
  length_preference: { value: "short" | "medium" | "long"; evidence: string };
  tone_signals: { value: string; evidence: string };
  writing_quirks: { value: string; evidence: string };
}

export interface PersonaMetadata {
  school_name: string | null;
  grade: number | null;
  class_number: number | null;
  import_format: "hitalk" | "kakaotalk" | "freeform";
}
