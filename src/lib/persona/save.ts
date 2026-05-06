import type { SupabaseClient } from "@supabase/supabase-js";
import type { SuccessfulExtractResponse } from "./schema";

export class SavePersonaError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "SavePersonaError";
  }
}

export async function savePersona(
  supabase: SupabaseClient,
  userId: string,
  extractResponse: SuccessfulExtractResponse
): Promise<string> {
  const { data, error } = await supabase
    .from("personas")
    .insert({
      user_id: userId,
      // name은 NULL (사용자가 클라이언트 화면에서 추후 입력)
      relationship_type: extractResponse.persona.relationship_type,
      student_label: extractResponse.persona.student_label,
      speaker_mixed: extractResponse.persona.speaker_mixed,
      speaker_classification_note: extractResponse.persona.speaker_classification_note,
      traits: extractResponse.persona.traits,
      metadata: extractResponse.metadata,
      anonymized_conversation: extractResponse.anonymized_conversation,
      // summary는 NULL (1주차에 AI 미생성)
    })
    .select("id")
    .single();

  if (error) {
    throw new SavePersonaError(
      `페르소나 INSERT 실패: ${error.message}`,
      error
    );
  }

  if (!data?.id) {
    throw new SavePersonaError("INSERT 후 id 반환 없음");
  }

  return data.id;
}
