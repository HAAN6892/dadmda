import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const TOKEN_REGEX = /^\d{6}$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "요청 형식이 올바르지 않습니다" },
      { status: 400 },
    );
  }

  const obj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const { email, token } = obj;

  if (
    typeof email !== "string" ||
    email.length > EMAIL_MAX ||
    !EMAIL_REGEX.test(email)
  ) {
    return NextResponse.json(
      { success: false, error: "올바른 이메일 형식이 아닙니다" },
      { status: 400 },
    );
  }
  if (typeof token !== "string" || !TOKEN_REGEX.test(token)) {
    return NextResponse.json(
      { success: false, error: "인증 코드는 6자리 숫자여야 합니다" },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("expired")) {
      return NextResponse.json(
        { success: false, error: "인증 코드가 만료되었습니다. 다시 요청해주세요" },
        { status: 400 },
      );
    }
    if (msg.includes("invalid")) {
      return NextResponse.json(
        { success: false, error: "인증 코드가 올바르지 않습니다" },
        { status: 400 },
      );
    }
    console.error("[verify-otp] supabase error:", error.message);
    return NextResponse.json(
      { success: false, error: "인증에 실패했습니다" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
