# 결정 기록 (Decision Log)

작업 진행 중 내린 비가역·반복 인용 결정만 적는다. 사소한 코드 선택은 git history로 충분.

---

## 2026-05-01 — Next 14 유지 + API Route 채택 (Server Actions 미사용)

**결정**
1주차 인증/데이터 변경 흐름은 Server Actions 대신 `src/app/api/**/route.ts` (API Route Handler)로만 구현한다. Next 14를 1주차 끝까지 유지하고, 1주차 종료 후 별도 브랜치(`chore/next16-upgrade`)에서 Next 16 마이그레이션을 1순위로 진행한다.

**검토한 대안**
- (A) API Route 방식 — 정책 #12 준수, Next 14 위에서 안전.
- (B) 정책 #12를 완화해 Server Actions 허용 — 정책 명시 위반, RSC deserialization DoS 노출.
- (C) 지금 즉시 Next 16 업그레이드 — 정책상 종료 후 1순위로 이미 예정. 지금 당기는 건 메타 도피 패턴.

**선택 이유**
- 정책 #12에 "1주차 한정" + "1주차 종료 후 별도 브랜치 마이그레이션 1순위" 명시 (CLAUDE.md 175, 182행).
- 1주차 목표는 4개 화면 완성 + 배우자 dogfooding 검증. 인증 인프라 깊게 파면 검증이 늦어짐.
- 즉시 업그레이드는 anti-drift 패턴 중 "메타 프로젝트 도피"와 "스코프 확장"에 해당.

**미래 마이그레이션 비용 검토**
- 코드량 차이: API Route는 fetch wrapper + handler로 약 1.5배. 작은 비용.
- 사용자 데이터 영향: 없음 (인증 흐름은 Supabase가 토큰 관리, 라우팅 방식만 다름).
- 마이그레이션 시 변환: API Route handler → Server Action 함수로 옮기는 건 1대1 매핑에 가까움. 비용 낮음.
- 결론: 지금 미루는 게 옵션 가치 보존에 유리 (검증 결과에 따라 Next 14에 머물 가능성도 열려 있음).

**재검토 시점**
- 1주차 종료 시점 (배우자 검증 결과 확인 후).
- `chore/next16-upgrade` 브랜치 작업 시작 전 본 결정문 다시 읽고 전제 조건 변경 여부 확인.

---

## 2026-05-01 — OTP API 별도 rate limiter 미도입 (1주차 후순위)

**결정**
`/api/auth/send-otp`, `/api/auth/verify-otp`에 자체 rate limiter(IP·이메일 기반 횟수 제한)를 도입하지 않고 1주차에는 Supabase 자체 발송 제한에 1차 방어를 위임한다.

**이유**
- 정책 #9의 진짜 의도는 **Anthropic API 비용 폭주 방지**. 이번 단계에는 Anthropic 호출 없음.
- Supabase는 OTP 발송에 시간당 자체 제한을 두므로 1차 방어선 역할 수행.
- 자체 rate limiter는 외부 저장소(Redis/Upstash KV 등) 셋업 필요 — 1주차 스코프 초과, 인프라 비용 발생.

**재검토 시점 (의무 도입)**
- Anthropic API 통합 시점 — 페르소나 추출(임포트 분석) 또는 메시지 작성(생성) 단계 진입 직전.
- 그 시점부터는 비용 폭주 위험이 실제이므로 rate limiter 의무 도입. 사용자당 일일/월 한도 + 의심 패턴 자동 차단까지 정책 #9 전 항목 충족 필요.

---

## 2026-05-01 — 미들웨어 matcher에서 `/api/*` 제외, API Route는 자체 인증 책임

**결정**
`src/middleware.ts`의 matcher 정규식 부정 룩어헤드에 `api`를 추가해 `/api/*` 전체를 미들웨어 처리 대상에서 제외한다. API Route 핸들러는 각자 필요한 만큼 자체적으로 `supabase.auth.getUser()` 호출 + 인증 응답 처리.

**발견 경위**
통합 테스트(`/login` 폼 → "인증 코드 받기" 클릭) 도중 브라우저 Network 탭에서 `POST /api/auth/send-otp`가 **307 Redirect → Location: /login**으로 응답되는 사고. 원인은 `src/lib/supabase/middleware.ts`의 `PUBLIC_PATHS = ["/login", "/auth"]`가 `/api/auth/...`를 잡지 못해(접두사가 `/api`) 비로그인 사용자에 대한 보호 경로로 분류된 것. 닭과 달걀: 로그인하려면 OTP API 호출 필요한데, API 호출은 로그인 후에만 허용되는 모순.

**검토한 대안**
- (A) `PUBLIC_PATHS`에 `/api/auth`를 추가 — 이번 사고는 막지만 API마다 인증 정책이 다른 미래 케이스(예: `personas/create`는 로그인 필요, `health`는 공개)에서 다시 분기 분기 가야 함.
- (B) matcher에서 `/api/*` 자체 제외 + API Route 자체 인증 책임 — Supabase 공식 SSR 예시 권장 패턴, 관심사 분리.
- (C) 미들웨어 안에서 `/api/*`는 세션만 갱신하고 리다이렉트는 안 하기 — `updateSession` 본문에 분기 추가, 결합도↑.

**선택: (B)**
- API Route는 응답 형식·HTTP 코드를 자기가 제어해야 하는데(JSON `{success,error}` + 적절한 status), 미들웨어가 끼어들어 307 Redirect로 가로채면 클라이언트 fetch 흐름이 깨짐.
- 미래 인증 정책 다양화에 대비.
- Supabase 공식 예시와 일치 → 유지보수·검색성 유리.

**미래 영향 (지킬 것)**
- 인증이 필요한 API Route는 핸들러 본문 최상단에서 `supabase.auth.getUser()` 호출 → user null이면 `NextResponse.json({success:false,error:"인증이 필요합니다"}, {status:401})` 반환.
- 인증 불필요 API(`send-otp`, `verify-otp`, 향후 `health` 등)는 그 호출 자체를 생략.
- 본 정책은 `.claude/memory/security_policy_checklist.md`에 "API Route 인증 체크" 항목으로 박제.

**보안 정책 영향**
- 정책 #12 조항 5("모든 인증 필요 페이지의 RSC 최상단에 인증 체크")는 **RSC 한정 조항**. API Route는 그 적용 대상 외. API Route는 본 결정문 + 신규 체크리스트 항목으로 별도 관리.
- 정책 #2(데이터 격리, RLS)는 계속 유효 — RLS가 `user_id = auth.uid()`를 강제하므로 API에서 인증 누락 시에도 DB 레벨 방어선이 남음. 단 API에서 401 안 내면 빈 결과/에러로 사용자 경험만 깨짐.

---

## 2026-05-02 — 인증을 OTP에서 Magic Link로 전환

**결정**
1주차 인증 흐름을 6자리 OTP 코드 입력에서 **Magic Link 클릭 방식**으로 전환한다. 사용자는 이메일 입력 → 발송된 메일의 링크 클릭 → `/auth/callback`에서 PKCE 코드 교환 → 홈으로 진입.

**배경**
- Supabase 무료 SMTP가 custom OTP 이메일 템플릿을 일관되게 적용하지 못하는 알려진 버그 발견 — 일부 발송분이 기본 Magic Link 템플릿으로 fallback.
- 우회책으로 Resend custom SMTP를 시도했으나 `onboarding@resend.dev` 발신 불가, 자체 도메인 등록·DNS 레코드 검증이 의무.
- 도메인 구매·DNS 셋업은 1주차 검증 단계 우선순위 밖 → anti-drift 패턴(스코프 확장) 회피.
- Supabase 기본 Magic Link 템플릿은 안정적 — 흐름 단순화 + UI 한 단계 제거 부수 효과.

**변경 사항**
- `src/app/api/auth/send-otp/route.ts`: `signInWithOtp` 옵션에 `emailRedirectTo: ${origin}/auth/callback` 추가. 핸들러 이름·경로는 유지(미래 OTP 복귀 시 재사용 비용 0).
- `src/app/auth/callback/route.ts` 신규: `GET` 핸들러, `code` 파라미터 검증(비어있지 않음 + 512자 이하), `exchangeCodeForSession` 호출, 성공 시 `/`로, 실패 시 `/login?error=expired|invalid_code`로 리다이렉트.
- `src/app/(public)/login/page.tsx`: 토큰 입력 단계(`stage="token"`) 제거, 발송 안내 단계(`stage="sent"`) 추가. URL `?error=...`도 클라이언트에서 읽어 안내.
- `src/lib/supabase/middleware.ts`: `PUBLIC_PATHS = ["/login", "/auth"]`의 `startsWith("/auth")`가 `/auth/callback`을 자동 커버 → 변경 불필요.

**보존 (의도적 미수정)**
- `src/app/api/auth/verify-otp/route.ts` — 미래 OTP 흐름 복귀 시 재활용 위해 그대로 둔다. 1주차 종료 후 도메인 구매·SMTP 정식 셋업 시점에 다시 살림.

**미래 재검토 시점**
- 자체 도메인 구매 + Resend/AWS SES SMTP 검증 완료 시점.
- 그때 OTP 흐름으로 복귀 검토 (코드 입력 UX가 새 탭 전환 없이 같은 창에서 끝나는 장점이 있음).
- 복귀 비용: send-otp의 `emailRedirectTo` 옵션 제거 + `/login/page.tsx`에서 `stage="token"` 분기 복구 + `/auth/callback` 라우트 비활성화 또는 삭제. 모두 작은 변경.

---

## 2026-05-02 — Magic Link 전환 되돌리기, OTP 흐름 유지 (같은 날 재결정)

**결정**
직전 결정(Magic Link 전환)을 같은 날 되돌린다. 1주차 인증 흐름은 OTP 6자리 입력 방식으로 최종 확정.

**배경**
- 직전 결정의 전제(Supabase 무료 SMTP가 한국어 OTP 템플릿을 일관되게 적용 못함)를 실측으로 재검증한 결과 — 테스트 시점에 우리 한국어 OTP 템플릿이 정상 적용됨. 메일에 6자리 숫자만 도착, Magic Link 본문 fallback 없음.
- 즉 Magic Link 전환은 임시 회피책이었고, 원래 의도(OTP)가 동작하므로 복귀.

**되돌리는 변경**
- `src/app/(public)/login/page.tsx`: `stage="sent"` 제거, `stage="token"` 분기 복원 (b128274 시점 동등 형태). `useEffect`로 URL `?error=...` 읽던 로직도 제거 (콜백 라우트 부재로 의미 없음).
- `src/app/api/auth/send-otp/route.ts`: `emailRedirectTo` 옵션 제거. `signInWithOtp` 옵션은 `shouldCreateUser: true`만 남음.
- `src/app/auth/callback/route.ts`: **삭제** (YAGNI). 미래 Magic Link 복귀 시 재작성. 빈 `src/app/auth/` 디렉터리도 함께 제거.

**잔존 트레이드오프**
- Supabase 무료 SMTP의 알려진 일관성 문제로 일부 사용자가 우연히 Magic Link 템플릿을 받는 케이스 잔존 가능성 — 발견 시 도메인 구매 + Resend/AWS SES 정식 셋업으로 해결 (1주차 후순위).
- Magic Link fallback 발생 시 사용자는 메일에서 받은 링크를 클릭해도 `/auth/callback`이 없어 404 또는 Supabase 기본 redirect URL로 가게 됨. 1주차 검증 단계에서 이 케이스가 실측으로 잡히면 그때 다시 Magic Link 흐름 복원 결정.

**메타 — 같은 날 두 번 뒤집은 결정에서 배운 것**
- 인프라 회피책(Magic Link 전환)을 적용하기 전, **현장 메일 한 번 더 보내 실측**해야 했다. SMTP fallback 버그가 *항상* 발생한다는 가정이 틀렸다.
- 다음에 비슷한 SMTP/외부 인프라 이슈 만나면: ① 1차 회피책 코드 작성 전, ② 같은 환경에서 5~10건 샘플 측정해 일관성 패턴 파악, ③ 그 후 회피책 채택 결정.

---

## 2026-05-02: shadcn/ui 도입

### 결정
- shadcn/ui new-york 스타일 + stone 베이스 컬러 도입
- 다크모드 라이트만 (1주차 X)
- Primary 컬러: shadcn 기본값(블랙) 유지
- 브랜드 컬러 / 뱃지 컬러: 1주차 보류 (홈 화면 작업 시 결정)
- 9개 컴포넌트 1차 설치: button, input, label, textarea, card, badge, radio-group, slider, select, sonner
- ESLint `next/image` import 금지 룰 추가 (정책 #12 강제)
- sonner는 next-themes 의존 제거하고 theme="light" 하드코딩
- 로그인 페이지 마이그레이션은 별도 작업으로 분리 (docs/2026-05-DD-login-shadcn-migration.md)

### 진행 중 발견 사항
- 1단계 init 시 shadcn@latest CLI가 Tailwind 4용 oklch + zinc로 박는 사고 발생. 수동으로 stone HSL 변수 + Tailwind 3.4 hsl 래핑 형식으로 정정. 이후 컴포넌트 설치는 shadcn@2.1.8로 버전 고정해서 진행.
- 프로젝트 루트에 ESLint 설정 파일이 부재했음. .eslintrc.json 신규 생성하면서 next/image 금지 룰 동시 적용.
- next-themes uninstall 시점에 npm vulnerability 5건(1 moderate, 4 high) 보고. 별도 후속 작업으로 분리 (docs/2026-05-DD-npm-audit-followup.md).

### 이유
- 다음 작업부터 컴포넌트 다양하게 필요
- 코드 복사 방식이라 lock-in 없음
- 브랜드 컬러는 흔들림 패턴(스코프 확장) 회피 위해 보류
- 로그인 분리는 "한 PR에 한 가지 일" 원칙
- vulnerability 분리도 같은 원칙 (셋업 커밋과 의존성 보안 처리는 별개 단위)

---

## 2026-05-02: Anthropic SDK 셋업

### 결정
- @anthropic-ai/sdk 도입 (공식 SDK, fetch 직접 호출 안 함)
- API 클라이언트는 싱글톤 패턴, src/lib/anthropic/client.ts에 위치
- 환경변수 ANTHROPIC_API_KEY는 서버 사이드 전용 (NEXT_PUBLIC_ prefix X, 정책 #12 준수)
- .env.local.example 신규 생성 (협업/배포용 템플릿, SUPABASE_SERVICE_ROLE_KEY는 미사용으로 제외)
- src/types/env.d.ts에서 환경변수 타입 정의 (3개 변수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY)
- Connection test용 /api/test/anthropic GET route는 검증 후 다음 작업 시작 시점에 삭제 예정 (임시)
- Connection test 모델: claude-haiku-4-5-20251001 (Haiku 4.5)
- 콘솔 spending limit 월 $20 설정됨 (rate limiter 코드 도입 전 안전장치)
- 페르소나 추출 / 메시지 다듬기 본 기능에 사용할 모델은 별도 결정점에서 선택 (Haiku vs Sonnet, 다음 작업)

### 진행 중 발견 사항
- 1단계에서 .env.local 변수명 확인 시 Grep 도구의 output_mode 설정 실수로 값까지 출력되는 사고 발생. 다행히 NEXT_PUBLIC_ 변수(클라이언트 노출 허용)만 값이 있었고 SERVICE_ROLE_KEY/ANTHROPIC_API_KEY는 빈 슬롯이라 실질 피해 없음. 이후 보안 원칙 강화: .env.local은 4단계 이후 절대 Read/Grep 금지, 변수명만 확보 후 더 이상 접근 안 함.
- 5단계 connection test 첫 호출에서 404 not_found_error 발생. 원인은 docs에 박은 모델명 claude-3-5-haiku-20241022가 deprecated/retired된 ID였음. 현재 정식 Haiku ID는 claude-haiku-4-5-20251001 (Haiku 4.5)로 정정. 키 인증은 정상 통과 → 인프라 코드 모두 정상 동작 확인.
- 보고 정확성 강화 원칙 도입: 파일 인용은 100% 파일에서 직접 복사, 손으로 다시 타이핑 금지.

### 이유
- SDK 사용이 fetch보다 타입 안전성 + 에러 핸들링 + 향후 streaming 등 기능 확장 유리
- 싱글톤은 매 요청마다 클라이언트 새로 만드는 비용 회피
- 임시 test route는 인프라 검증을 빠르게 하기 위함, 본 기능 구현 시 정식 route로 대체

### 다음 단계
- DB 스키마 (personas, messages 테이블 + RLS)
- 페르소나 추출 API Route + rate limiter (정책 #9, Anthropic API 본격 사용 시점에 도입)
- 페르소나 추출 프롬프트 작성
- 페르소나 만들기 화면 UI
- 본 기능에 사용할 모델 결정 (Haiku 4.5 vs Sonnet 4.6, 비용/품질 트레이드오프)
