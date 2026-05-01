import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;

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

  const email =
    body && typeof body === "object" && "email" in body
      ? (body as { email: unknown }).email
      : null;

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

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit")) {
      return NextResponse.json(
        { success: false, error: "잠시 후 다시 시도해주세요" },
        { status: 429 },
      );
    }
    if (msg.includes("invalid") && msg.includes("email")) {
      return NextResponse.json(
        { success: false, error: "올바른 이메일 형식이 아닙니다" },
        { status: 400 },
      );
    }
    console.error("[send-otp] supabase error:", error.message);
    return NextResponse.json(
      { success: false, error: "메일 발송에 실패했습니다. 다시 시도해주세요" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
