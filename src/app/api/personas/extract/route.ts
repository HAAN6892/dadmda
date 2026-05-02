import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRatelimit } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  try {
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

    const { success, limit, remaining, reset } = await getRatelimit().limit(
      user.id,
    );

    const rateLimitHeaders = {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": reset.toString(),
    };

    if (!success) {
      return NextResponse.json(
        { success: false, error: "잠시 후 다시 시도해주세요" },
        { status: 429, headers: rateLimitHeaders },
      );
    }

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
    if (conversation.length < 1) {
      return NextResponse.json(
        { success: false, error: "대화 내용을 입력해주세요" },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "페르소나 추출 로직 미구현 (다음 세션)",
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
