# 보안 정책 #12 자동 점검 체크리스트 (1주차 한정)

원본: `CLAUDE.md` "#### 12. Next.js 14 취약점 완화 조건 (1주차 한정)"
적용 시점: 코드 작성 직후, 코드 리뷰 직전, 커밋 전.
위반 1건 발견 시: **즉시 작업 중단 → 사용자에게 보고 → Next 16 마이그레이션 우선 검토** (CLAUDE.md 181~182행).

---

## 조항 1. `next/image`의 외부 URL 사용 금지
회피 대상: Image Optimizer `remotePatterns` DoS

**점검 명령**
```bash
grep -rn "remotePatterns" next.config.mjs next.config.js next.config.ts 2>/dev/null
grep -rn "from ['\"]next/image['\"]" src/
```
**합격 기준**
- `remotePatterns` 키 자체가 `next.config.*`에 없어야 함
- `next/image` import가 발견되면 조항 4와 같이 위반 (조항 4가 import 자체를 금지)

---

## 조항 2. `next.config.mjs`의 `rewrites` 사용 금지
회피 대상: HTTP request smuggling

**점검 명령**
```bash
grep -nE "^\s*rewrites\s*[:(]" next.config.mjs next.config.js next.config.ts 2>/dev/null
```
**합격 기준**
- 출력 없음. `rewrites()` 메서드도, `rewrites:` 키도 없어야 함
- `redirects`, `headers`는 별개라 허용

---

## 조항 3. Server Actions(`"use server"`) 사용 금지
회피 대상: RSC deserialization DoS
대안: 데이터 변경은 `src/app/api/**/route.ts`만 사용

**점검 명령**
```bash
grep -rn "['\"]use server['\"]" src/
```
**합격 기준**
- 어떤 파일에도 `"use server"` 또는 `'use server'` 디렉티브 없음
- `actions.ts` 패턴 파일명 자체를 만들지 말 것 (혼동 방지)
- 폼은 `<form action={fn}>` 대신 `onSubmit` 또는 `fetch('/api/...')` 사용

---

## 조항 4. `next/image` 컴포넌트 사용 자체 금지
회피 대상: disk cache DoS
대안: `<img>` 태그 또는 Supabase Storage URL 직접 삽입

**점검 명령**
```bash
grep -rnE "from ['\"]next/image['\"]|<Image[ />]" src/
```
**합격 기준**
- import 0건, JSX `<Image>` 0건
- 외부 이미지 URL은 `<img src="https://...">` 직접 사용

---

## 조항 5. 인증 필요 페이지 RSC 최상단에 인증 체크
회피 대상: Server Components DoS (익명 요청이 RSC 렌더 트리에 진입하는 것 차단)

**점검 명령**
```bash
ls src/app/\(protected\)/layout.tsx
grep -n "supabase.auth.getUser\|redirect" src/app/\(protected\)/layout.tsx
```
**합격 기준**
- `src/app/(protected)/layout.tsx` 존재
- 해당 파일 최상단에서 `supabase.auth.getUser()` 호출 + 비인증 시 `redirect('/login')`
- 새 인증 필요 라우트를 추가할 때는 반드시 `(protected)` 그룹 아래에 둘 것
- 단일 페이지에서 별도 가드 추가는 OK이지만, **그룹 레이아웃 가드 우회는 금지**

---

## 조항 6. 위반 시 후속 조치
- 1건이라도 위반 검출 시: 즉시 작업 중단
- 사용자에게 위반 항목·위치 보고
- 1주차 종료 후 `chore/next16-upgrade` 브랜치에서 Next 16 마이그레이션 (1순위 작업)
- 마이그레이션 완료 후 본 체크리스트 무효 처리 (또는 Next 16 기준 새 체크리스트로 교체)

---

## 일괄 점검 명령 (한 번에 돌리기용)
```bash
echo "[1] remotePatterns:" && grep -rn "remotePatterns" next.config.* 2>/dev/null
echo "[2] rewrites:"       && grep -nE "^\s*rewrites\s*[:(]" next.config.* 2>/dev/null
echo "[3] use server:"     && grep -rn "['\"]use server['\"]" src/ 2>/dev/null
echo "[4] next/image:"     && grep -rnE "from ['\"]next/image['\"]|<Image[ />]" src/ 2>/dev/null
echo "[5] auth guard:"     && grep -n "getUser\|redirect" "src/app/(protected)/layout.tsx" 2>/dev/null
```
출력이 [3]/[4]에서 비어있고, [1]/[2]에서 비어있고, [5]에서 `getUser`+`redirect` 검출되면 합격.

---

## API Route 인증 체크 (미들웨어 외 별도)

배경: `src/middleware.ts` matcher에서 `/api/*` 제외했으므로 API Route는 자체적으로 인증 책임. 사고 재발 방지용 점검 절차.

**새 API Route(`src/app/api/**/route.ts`) 작성 시 의무 절차**
1. 핸들러 헤더 주석 또는 상수로 **인증 필요 여부 명시** (예: `const REQUIRE_AUTH = true;` 또는 `// public: OTP 발송용 비로그인 호출 허용`).
2. 인증 필요한 경우 핸들러 최상단(입력 검증 직후)에 다음 패턴 삽입:
   ```ts
   const supabase = createClient();
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) {
     return NextResponse.json(
       { success: false, error: "인증이 필요합니다" },
       { status: 401 },
     );
   }
   ```
3. 인증 불필요한 경우(공개 API)도 주석으로 의도 명시 — 누락 아님을 분명히.

**점검 명령**
```bash
# 모든 API Route 핸들러에서 getUser 호출 또는 "public" 주석이 있는지
for f in $(find src/app/api -name "route.ts" 2>/dev/null); do
  echo "=== $f ==="
  grep -nE "getUser|public:|// public" "$f" || echo "  ⚠️ 인증 명시 없음"
done
```
**합격 기준**
- 각 `route.ts`에 `getUser()` 호출 또는 `public:` 주석 1건 이상.
- 인증 필요 API에 `getUser()` 호출 누락 시 ⚠️ — 즉시 사용자 보고.

**현재 상태 (2026-05-01 기준)**
- `/api/auth/send-otp` — 공개 (로그인 전 호출). 명시: 추후 주석 추가 필요.
- `/api/auth/verify-otp` — 공개 (로그인 전 호출). 명시: 추후 주석 추가 필요.
