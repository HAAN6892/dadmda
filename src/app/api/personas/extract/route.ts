import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRatelimit } from "@/lib/ratelimit";
import { extractPersona, ExtractError } from "@/lib/persona/extract";
import { savePersona, SavePersonaError } from "@/lib/persona/save";

const MIN_LENGTH = 10;
const MAX_LENGTH = 50000;

function sanitizeConversation(text: string): string {
  return text.replace(/\0/g, "").replace(/\n{50,}/g, "\n\n\n\n\n");
}

export async function POST(request: NextRequest) {
  try {
    // 1. 인증
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다" },
        { status: 401 },
      );
    }

    // 2. Rate limit
    const {
      success: rateLimitOk,
      limit,
      remaining,
      reset,
    } = await getRatelimit().limit(user.id);

    const rateLimitHeaders = {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": reset.toString(),
    };

    if (!rateLimitOk) {
      const retryAfterSeconds = Math.max(
        0,
        Math.ceil((reset - Date.now()) / 1000),
      );
      return NextResponse.json(
        {
          success: false,
          error: "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
          retry_after_seconds: retryAfterSeconds,
        },
        { status: 429, headers: rateLimitHeaders },
      );
    }

    // 3. 입력 검증
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "요청 형식이 올바르지 않습니다" },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    const obj =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const { conversation } = obj;

    if (typeof conversation !== "string") {
      return NextResponse.json(
        { success: false, error: "대화 내용을 입력해주세요" },
        { status: 400, headers: rateLimitHeaders },
      );
    }
    if (conversation.trim().length < MIN_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `대화 내용은 최소 ${MIN_LENGTH}자 이상 입력해주세요`,
        },
        { status: 400, headers: rateLimitHeaders },
      );
    }
    if (conversation.length > MAX_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `대화 내용은 ${MAX_LENGTH.toLocaleString()}자 이하로 입력해주세요`,
        },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    // 4. Sanitization (가벼운 가드)
    const sanitized = sanitizeConversation(conversation);

    // 5. 페르소나 추출
    let llmResult;
    try {
      llmResult = await extractPersona(sanitized);
    } catch (err) {
      if (err instanceof ExtractError) {
        const status = err.stage === "api" ? 502 : 500;
        return NextResponse.json(
          { success: false, error: err.message, stage: err.stage },
          { status, headers: rateLimitHeaders },
        );
      }
      console.error("[personas/extract] extract error:", err);
      return NextResponse.json(
        { success: false, error: "알 수 없는 오류" },
        { status: 500, headers: rateLimitHeaders },
      );
    }

    // 6. 거부 분기 — DB INSERT 안 하고 400 응답
    // ExtractLLMResponse는 (RejectedResponse | SuccessfulExtractResponse) union.
    // RejectedResponse만 rejected 키를 가지므로 in narrowing으로 분기.
    if ("rejected" in llmResult) {
      return NextResponse.json(
        { success: false, error: llmResult.reason },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    // 7. DB 저장
    let personaId: string;
    try {
      personaId = await savePersona(supabase, user.id, llmResult);
    } catch (err) {
      if (err instanceof SavePersonaError) {
        console.error("[personas/extract] save error:", err);
        return NextResponse.json(
          { success: false, error: "페르소나 저장에 실패했습니다" },
          { status: 500, headers: rateLimitHeaders },
        );
      }
      console.error("[personas/extract] unknown save error:", err);
      return NextResponse.json(
        { success: false, error: "알 수 없는 오류" },
        { status: 500, headers: rateLimitHeaders },
      );
    }

    // 8. 응답 — persona_id 평탄화
    return NextResponse.json(
      {
        success: true,
        data: {
          persona_id: personaId,
          ...llmResult,
        },
      },
      { status: 200, headers: rateLimitHeaders },
    );
  } catch (err) {
    console.error("[personas/extract] unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
