"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "email" | "token";

type ApiResponse = { success: boolean; error?: string };

export default function LoginPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendOtp(targetEmail: string): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!data.success) {
        setError(data.error ?? "메일 발송에 실패했습니다. 다시 시도해주세요");
        return false;
      }
      return true;
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await sendOtp(email);
    if (ok) {
      setToken("");
      setStage("token");
    }
  }

  async function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!data.success) {
        setError(data.error ?? "인증에 실패했습니다");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요");
    } finally {
      setLoading(false);
    }
  }

  function handleResendCode() {
    setToken("");
    void sendOtp(email);
  }

  function handleSwitchEmail() {
    setEmail("");
    setToken("");
    setError(null);
    setStage("email");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-6 text-center">
          다듬다 로그인
        </h1>

        {stage === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
            >
              {loading ? "발송 중..." : "인증 코드 받기"}
            </button>
          </form>
        )}

        {stage === "token" && (
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-900 break-all">
                {email}
              </span>{" "}
              으로 보낸
              <br />
              인증 코드 6자리를 입력해주세요
            </p>
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                인증 코드
              </label>
              <input
                id="token"
                type="text"
                value={token}
                onChange={(e) =>
                  setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-lg"
                placeholder="000000"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || token.length !== 6}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
            >
              {loading ? "확인 중..." : "확인"}
            </button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="text-blue-600 hover:underline disabled:opacity-50"
              >
                코드 다시 받기
              </button>
              <button
                type="button"
                onClick={handleSwitchEmail}
                disabled={loading}
                className="text-gray-600 hover:underline disabled:opacity-50"
              >
                다른 이메일로 시도
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
