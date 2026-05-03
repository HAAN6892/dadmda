import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic/client";
import { SYSTEM_PROMPT } from "./system-prompt";
import { FEW_SHOTS } from "./few-shots";
import { ExtractResponseSchema, type ExtractResponse } from "./schema";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.3;

export class ExtractError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly stage?: "api" | "parse" | "validate",
  ) {
    super(message);
    this.name = "ExtractError";
  }
}

export async function extractPersona(
  conversationText: string,
): Promise<ExtractResponse> {
  const messages: Anthropic.MessageParam[] = [];

  for (const fewShot of FEW_SHOTS) {
    messages.push({ role: "user", content: fewShot.input });
    messages.push({ role: "assistant", content: fewShot.output });
  }

  messages.push({ role: "user", content: conversationText });

  const anthropic = getAnthropicClient();

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages,
    });
  } catch (err) {
    throw new ExtractError("Anthropic API 호출 실패", err, "api");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ExtractError("응답에 텍스트 블록이 없음", undefined, "parse");
  }
  const rawText = textBlock.text.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new ExtractError(
      `JSON 파싱 실패. 응답 본문: ${rawText.slice(0, 500)}`,
      err,
      "parse",
    );
  }

  const validation = ExtractResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new ExtractError(
      `스키마 검증 실패: ${validation.error.message}`,
      validation.error,
      "validate",
    );
  }

  return validation.data;
}
