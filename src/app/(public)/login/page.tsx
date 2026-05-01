export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">로그인</h1>
        <p className="text-sm text-gray-500">
          (placeholder — Supabase Auth 폼은 다음 단계)
        </p>
        {/* TODO: 비밀번호 minLength={8} 강제 — 원칙 #4 */}
      </div>
    </main>
  );
}
