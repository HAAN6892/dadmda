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

---

## 2026-05-02: Supabase CLI 셋업

### 결정
- Migration 관리 방식: 옵션 B (Supabase CLI + git 관리). DB 스키마를 코드의 일부로 취급 → 재현 가능성 + 협업/배포 대비
- CLI 설치 방법: Scoop (Windows 패키지 매니저) 사용. npm 글로벌 설치는 Supabase 공식 비권장이라 회피
- supabase/ 폴더를 프로젝트 루트에 생성. config.toml + .gitignore + .temp/ 자동 생성됨
- IDE 통합(VSCode, IntelliJ workspace settings) 비활성화. 1주차 단순화 + 협업자별 설정 다를 수 있음
- Project ID와 Database password는 사용자가 PowerShell에 직접 입력. Claude Code 컨텍스트에 노출하지 않음
- .gitignore: supabase/.gitignore 자동 생성 + 루트 .gitignore에 명시적 의도 표시 3줄 추가 (이중 안전망)

### 진행 중 발견 사항
- 사용자 환경에 Scoop 미설치 상태 → docs에 Scoop 설치부터 포함 (1단계). PowerShell ExecutionPolicy 변경 필요했음
- supabase link 시 Database password 프롬프트 미출현. 일부 link 작업은 access token만으로 충분하고 비번은 실제 DB 직접 접근(예: db push, db diff 일부) 시점에 필요. supabase projects list로 LINKED 마크 확인됨
- config.toml의 [[auth.email]] otp_expiry=3600은 로컬 Supabase 인스턴스용 기본값. 원격 Dashboard에는 600초로 설정되어 있음. 원격 직접 사용 모드라 영향 없음. 미래에 supabase start로 로컬 인스턴스 사용 시 동기화 필요
- 7단계 검증 명령어를 db pull --schema public --dry-run에서 migration list로 교체. CLI 2.95.4에서 --dry-run 플래그 미지원 발견. migration list가 비파괴 + 메타데이터 조회 + link 정상 + 빈 schema 검증을 동시 만족하므로 더 적합

### 이유
- Migration이 코드의 일부라는 원칙. git에 없으면 재현 불가능
- Scoop은 미래 다른 도구(gh CLI, terraform 등) 설치 시에도 활용 가능. 일회성 셋업 비용으로 다회 가치
- Database password 같은 민감 정보는 사용자 직접 처리 단위로 분리해서 Claude Code 컨텍스트 오염 방지
- 이중 .gitignore는 supabase/.gitignore가 사고로 삭제되어도 루트 파일이 안전망 역할

### 다음 단계
- students + personas 테이블 + RLS migration 작성 (supabase/migrations/ 폴더에 SQL 파일)
- supabase db push로 원격 DB에 적용
- 페르소나 추출 / 메시지 다듬기 본 기능 작업
- /api/test/anthropic 임시 라우트 삭제 (다음 작업 시작 시점)

---

## 2026-05-02: personas 테이블 마이그레이션

### 결정
- 1주차 테이블 1개만 생성: personas. students 테이블은 미래 확장 시 분리
- 학생 그룹핑은 student_label TEXT 컬럼으로 처리 (1주차 단순화)
- relationship_type 컬럼 포함 (1주차 'parent' 고정, 미래 colleague/external 확장 대비)
- traits 컬럼은 jsonb (구조 자유도 확보, 스키마는 추출 프롬프트 단계에서 확정)
- anonymized_conversation 단일 컬럼 누적 방식 (1주차 단순화. 길어지면 별도 테이블로 분리 검토)
- Soft delete (deleted_at). RLS에서 자동 필터로 삭제된 행 비공개
- RLS 정책 4개 (SELECT/INSERT/UPDATE/DELETE) 모두 auth.uid() = user_id 기준
- updated_at 자동 갱신 트리거 (set_updated_at 함수, 미래 다른 테이블도 재사용 가능)
- DB 코멘트로 컬럼별 의도 자체 문서화

### 진행 중 발견 사항
- docs 작성 시 4단계 검증 안내의 컬럼 카운팅 표기에 오타(9개로 적음) 발견. 실제 SQL은 11개로 정확. Dashboard 검증은 11개 기준으로 진행함.
- supabase db push 시점에도 비번 프롬프트 미출현. supabase link 때와 동일하게 access token으로 충분. CLI 2.95.4 기준 migration apply도 token 기반 인증 처리. Database password는 CLI 외 직접 DB 접속(예: psql) 시에만 필요.

### 이유
- 1주차는 메인 흐름(임포트 → 페르소나 → 메시지 다듬기) 검증이 핵심. 테이블 분리는 검증 후
- student_label 컬럼은 텍스트로 두면 미래에 students 테이블 분리 시 마이그레이션 단순 (컬럼 → FK)
- jsonb는 페르소나 특징 구조가 사용자 데이터 보면서 진화할 수 있어서. 컬럼 분리는 구조 확정 후
- soft delete는 학부모 정보라는 민감 데이터 특성상 실수 복구 가능성 우선
- DB 코멘트는 미래의 너/협업자가 컬럼 의도 즉시 파악 가능

### 다음 단계
- 페르소나 추출 API Route + rate limiter (정책 #9 도입 시점, Anthropic API 본격 사용)
- 페르소나 추출 프롬프트 작성 (비식별화 + 페르소나 추출 동시 처리)
- 페르소나 만들기 화면 UI
- /api/test/anthropic 임시 라우트 삭제

---

## 2026-05-03 새벽: 작업 A/B 결정 통합 기록 (rate limiter 도입 + API Route 골격)

> 같은 세션 산출물 7개 결정을 단일 엔트리로 묶음. 작업 A는 connection test 임시 라우트 제거 (커밋 77965ed), 작업 B는 페르소나 추출 API Route 골격 + rate limiter (커밋 5b95f7a), docs 별도 커밋 (83970d6).

### 결정 1: Rate limiter 도입 시점 — 정책 #9 활성화

페르소나 추출 API Route 골격 작업에서 정책 #9 (rate limiting)을 활성화. 이전 결정(2026-05-01 OTP API rate limiter 미도입)에 박아둔 "재검토 시점: Anthropic API 통합 시점"이 이번 작업으로 도래. 라우트 자체는 stub이지만 다음 세션에서 Anthropic 호출이 들어가는 즉시 보호 작동하도록 골격에 함께 박음.

### 결정 2: Rate limiter 구현 방식 — Upstash Redis

#### 선택
`@upstash/ratelimit` + `@upstash/redis` (외부 서비스)

#### 검토한 대안
- Supabase 테이블 기반: 보일러플레이트 많음 (테이블 + 트랜잭션 + cleanup + RLS), 1주차 임시 안전장치를 비즈니스 DB와 섞기 부적절
- 메모리 기반: Vercel 서버리스에서 인스턴스마다 카운트 따로 돌아 사실상 무력화 → 즉시 탈락

#### 이유
- Vercel + Next.js 서버리스에서 사실상 표준
- 무료 티어 10K command/day로 1주차 충분
- 폐기 비용 낮음 (env만 빼면 비활성화, 코드는 lazy init이라 throw)

### 결정 3: Rate limit 값 — 10 req / 1분 / 사용자

- 알고리즘: Sliding window (고정 window보다 burst 방어 강함)
- 키 단위: `user.id`
- prefix: `@dadmda/ratelimit` (Upstash DB 다른 앱과 충돌 방지, 미래 다른 ratelimit 추가 시 키 충돌 방지)
- analytics: true (Upstash 콘솔에서 사용 패턴 관찰)

#### 이유
페르소나 추출은 한 번 추출 후 결과 검토에 분 단위 소요. 정상 사용자가 1분에 10번 이상 호출할 일 없음. 봇/스크립트 차단에 충분. 1주차엔 코드 상수, 미래에 env 분리 가능.

### 결정 4: API Route 응답 형식 일관성 — 다음 세션에서 정리

#### 결정
stub 응답이 `{ ok: true, message: "..." }`로 다른 응답들의 `{ success, error }` 패턴과 미세하게 어긋남. 이번 세션에서는 **그대로 둠**. 다음 세션에서 실제 추출 로직 추가 시 자연스럽게 정리.

#### 다음 단계
stub 자리를 실제 추출 결과로 교체할 때 `{ success: true, data: {...} }` 형태로 통일.

### 결정 5: conversation 입력 검증 강화 — 다음 세션에서

#### 결정
현재 `typeof === "string" && length >= 1`만 체크 (공백만 있어도 통과). 이번 세션에서는 **그대로 둠**.

#### 다음 단계
`conversation.trim().length >= N` 형태로 강화. 추가로 비식별화 사전 체크 (이미 비식별화된 텍스트가 들어왔는지) 도입 검토.

### 결정 6: 수동 테스트 (4케이스 통합) 스킵

docs상 선택 항목인 4케이스 통합 테스트를 스킵. 근거: PowerShell에서 인증 쿠키 다루는 비용이 높음 (Claude Code 명령 복사할 때마다 쿠키 클립보드 덮어쓰는 사고 반복). 빌드 통과 + 코드 직접 검토로 골격 검증 충분 판단. 다음 세션에서 Anthropic 호출 추가 시 자연스럽게 통합 검증. 위험 평가: 골격 자체에 문제 있으면 다음 세션 첫 호출 시 즉시 발견됨, 위험 낮음.

### 결정 7: docs 커밋 분리 패턴

코드 커밋(`feat:`, `chore:`)과 프롬프트 docs 커밋(`docs:`) 분리. 작업 A의 `chore: connection test 임시 라우트 제거` 커밋도 코드만 들어갔음. 패턴 일관성 + docs untracked 부채 누적 방지. 이번 세션에서는 작업 A/B의 docs 2개를 묶어서 단일 `docs:` 커밋(83970d6)으로 처리.

---

## 2026-05-03 새벽: 페르소나 추출 본 로직 사전 결정

### 결정 8: 페르소나 추출 / 비식별화 모델 = Sonnet 4.6

- **일시**: 2026-05-03
- **맥락**: 작업 B에서 페르소나 추출 API Route 골격(`src/app/api/personas/extract/route.ts`)을 stub으로 구현 완료. 다음 단계는 stub 자리에 실제 Anthropic API 호출 로직을 채우는 일. 그 전에 어떤 모델을 쓸지 확정 필요.
- **선택지**:
  - **Haiku 4.5** (`claude-haiku-4-5-20251001`): $1 / $5 per MTok, 200K 컨텍스트
  - **Sonnet 4.6** (`claude-sonnet-4-6`): $3 / $15 per MTok, 1M 컨텍스트 (standard rate)
- **결정**: **Sonnet 4.6** 선택
- **근거**:
  1. **검증 단계의 변수 최소화**. 1주차는 "4축 영점조절이 교사 워크플로에 맞는지" 검증이 목표. 모델 품질이 변수가 되면 신호 오염됨. 프롬프트·UX만 변수로 두고 모델은 충분히 좋은 것으로 고정.
  2. **비식별화 사고 비용 > 토큰 비용**. PII 누락 시 1차 사용자(배우자) 신뢰 박살. 페르소나 추출 누락은 검토 단계에서 사용자가 수정 가능하지만 비식별화 누락은 DB 저장 시점에 이미 사고. 정확도 마진을 사야 함.
  3. **비용 절대값 부담 없음**. 호출 1회 ≈ 입력 3K + 출력 1.5K 토큰 가정 시 $0.0315. 월 $20 한도 내 약 630회. 1차 사용자 단독 사용으로 충분.
  4. **Haiku 마이그레이션은 나중에 가능**. Sonnet → Haiku 다운그레이드는 비교적 부담 적음 (프롬프트 캐싱 / 모델 분리 등 옵션). 반대 방향보다 쉬움.
  5. **공식 권장 production 디폴트가 Sonnet**. 1차 출시 단계에서 깨고 갈 강한 이유 현재 없음.
- **불채택 사유 (Haiku 4.5)**:
  - 비식별화 누락 리스크 — 한국어 PII 패턴 (호칭/병명/학교명 등)에서 정확도 마진이 작은 모델 선택은 1차 사용자 신뢰 측면에서 부적절
  - 모델 한계와 프롬프트 한계를 분리하기 어려움 — 1차 검증 단계 변수 오염
- **트레이드오프 비용**: 호출당 약 3배 비용. 1차 사용자 단독 사용 단계에서는 절대값 미미.
- **재검토 트리거**:
  - 사용자 10명 이상 정착 + Sonnet 비용이 월 $10 초과
  - 사용자 피드백에서 "응답 느림" 1회 이상 언급
  - 비식별화·페르소나 추출이 안정화되어 프롬프트 변경 빈도가 주 1회 미만
- **연결 작업**: 다음 docs (페르소나 추출 본 로직 구현)에서 `src/lib/anthropic.ts` 또는 추출 라우트 내에 `MODEL_PERSONA_EXTRACTION = "claude-sonnet-4-6"` 상수로 박을 것. 매직 스트링 박지 말 것.

### 결정 9: traits JSONB 구조 = {value, evidence}

- **일시**: 2026-05-03
- **맥락**: 페르소나 추출 결과의 communication_style을 어떻게 저장할지. 단순 enum value만 박을지, 근거를 함께 저장할지.
- **선택지**:
  - (a) value만: `formality: "medium"`
  - (b) value + evidence: `formality: { value: "medium", evidence: "선생님 호칭 + 존댓말, 띄어쓰기 정돈 X" }`
- **결정**: (b) value + evidence
- **근거**:
  1. 1주차 검증 단계에서 사용자(교사)가 "AI가 왜 이렇게 판단했지?"를 즉시 확인 가능
  2. 페르소나 수정 의사결정 근거 제공
  3. 1차 사용자(배우자) 신뢰도 = 추출 정확도 + 투명성 두 축. evidence 필드는 후자 담당
- **트레이드오프**: JSON 깊이 +1. 출력 토큰 약간 증가. 미미.
- **연결 작업**: 다음 세션 docs A에서 시스템 프롬프트와 응답 스키마에 반영.

### 결정 10: 1주차 임포트 입력 형식 = 텍스트 붙여넣기만

- **일시**: 2026-05-03
- **맥락**: 임포트 UX를 텍스트 붙여넣기로 갈지 PDF 업로드까지 넣을지.
- **선택지**:
  - (a) 텍스트 붙여넣기만 1주차
  - (b) PDF 업로드도 1주차에 포함 (비번 처리 + 파싱 라이브러리 + 에러 처리)
- **결정**: (a) 텍스트 붙여넣기만
- **근거**:
  1. 1주차 목표 = "4축 영점조절이 교사 워크플로에 맞는지" 검증. 임포트 UX 검증이 아님
  2. PDF 비밀번호 처리는 보안 정책 #12 충돌 가능 (별도 결정 필요)
  3. 1차 사용자(배우자) 페르소나 만들기 횟수 제한적 (학부모당 1번). 복붙 마찰 미미
  4. 진짜 마찰은 "메시지 작성" 화면이지 "페르소나 만들기" 화면이 아님
- **재검토 트리거**: 1주차 검증 후 사용자 피드백에서 "복붙 번거롭다" 1회 이상 언급 시.
- **연결 작업**: 페르소나 만들기 화면 UI는 단일 textarea + 붙여넣기 버튼.

### 결정 11: 메타데이터 추출 = best-effort, 형식별 차등

- **일시**: 2026-05-03
- **맥락**: PDF 헤더 메타데이터(학교/학년/반/학생명) 자동 추출 정책. 단 메신저 종류별로 헤더 구조 다름 (하이톡 = 명시적 / 카카오톡 = 거의 없음 / 자유 형식 = 없음).
- **추가 발견 사항**: 학생 본인 라벨에 학부모가 끼어들어 메시지 보내는 경우 존재 ((실제 학생) 샘플). 헤더 라벨 ≠ 실제 화자.
- **선택지**:
  - (a) 자동 추출 → 자동 반영 (모든 형식 동일 처리)
  - (b) Best-effort: 추출 가능하면 값, 아니면 null. 사용자가 페르소나 만들기 화면에서 수동 보완
  - (c) 메타데이터 추출 X, 사용자가 항상 수동 입력
- **결정**: (b) Best-effort
- **근거**:
  1. 카카오톡/자유 형식은 헤더 메타데이터 부재 → (a)는 무력화
  2. 학생 라벨에 학부모 끼어듦 같은 케이스 → 라벨 100% 신뢰 위험
  3. (c)는 하이톡 사용 시 불필요한 마찰
  4. null 허용 + 수동 보완은 페르소나 만들기 화면 UX와 자연스럽게 호환
- **응답 스키마**:
  ```json
  {
    "metadata": {
      "source_format": "high_class | kakao_talk | free_form",
      "school": "값 또는 null",
      "grade": "값 또는 null",
      "class": "값 또는 null",
      "student_name": "값 또는 null"
    }
  }
  ```
- **연결 작업**: 다음 세션 docs A에서 시스템 프롬프트의 작업 0단계(형식 추론) + 메타데이터 best-effort 추출 명시.

### 결정 12: 출력 형식 강제 = 시스템 프롬프트 JSON-only

- **일시**: 2026-05-03
- **맥락**: Anthropic API에서 구조화 JSON 응답 받는 방법.
- **선택지**:
  - (a) 시스템 프롬프트 JSON-only 강제 + 응답 텍스트 파싱
  - (b) Tool use (function calling) 으로 스키마 정의
- **결정**: (a) 시스템 프롬프트 JSON-only
- **근거**:
  1. 1주차에는 프롬프트 자주 바뀜. Tool use 스키마 같이 수정 비용 큼
  2. JSON 파싱 실패 시 EXTRACTION_FAILED 반환 + 1회 retry 없음 (1주차 단순화)
  3. Tool use 도입은 스키마 안정화 후 별도 결정
- **재검토 트리거**: JSON 파싱 실패율이 호출 100건 중 5건 초과 시 Tool use 도입 검토.
- **연결 작업**: 다음 세션 docs A에서 라우트의 `try { JSON.parse(...) } catch { EXTRACTION_FAILED }` 흐름 구현.

### 결정 13: Few-shot 예시 = 5개 (하이톡 3 + 카카오톡 1 + 자유 1)

- **일시**: 2026-05-03
- **맥락**: 시스템 프롬프트에 박을 Few-shot 예시 개수와 다양성. 메신저 형식 다양성 + 학부모 페르소나 다양성 모두 커버 필요.
- **선택지**:
  - (a) 1개 (하이톡 + 위기 정서)
  - (b) 3개 (하이톡 + 카카오톡 + 자유)
  - (c) 5개 (하이톡 3개 다양화 + 카카오톡 + 자유)
- **결정**: (c) 5개
- **근거**:
  1. 사용자 요청: "선생님들이 쓸만한 메신저는 다 지원" + "전체 긁어서 알아서 학부모/선생님 구분"
  2. 하이톡이 주 사용 형식이지만 학부모 페르소나 다양성 (위기/일상 격식 high/혼합 라벨) 커버 필요
  3. 카카오톡/자유 형식 각 1개로 화자 추론 규칙 검증
  4. 토큰 비용 영향 미미 (호출당 약 $0.05, 월 $20 내 400회 호출 가능)
- **Few-shot 구성**:
  | # | 형식 | 케이스 | 출처 |
  |---|---|---|---|
  | 1 | 하이톡 | 위기 + 정서·medium 격식 | (실제 학부모) (제공받음) |
  | 2 | 하이톡 | 일상 + 격식 high·길이 long·이모티콘 | (실제 학부모2) (제공받음) |
  | 3 | 하이톡 | 학생 라벨 + 학부모 끼어듦 혼합 | (실제 학생) (제공받음) |
  | 4 | 카카오톡 | 학부모-교사 컨텍스트 | 가상 작성 (다음 세션) |
  | 5 | 자유 형식 | 명시적 라벨 대화 형식 | 가상 작성 (다음 세션) |
- **트레이드오프**: 시스템 프롬프트 약 6K → 9K 토큰. 호출당 입력 비용 $0.018 → $0.027.
- **재검토 트리거**: 1주차 검증 후 추출 정확도 90% 미만이면 Few-shot 추가 또는 fine-tuning 검토.
- **연결 작업**: 다음 세션 docs A에서 시스템 프롬프트 본문 작성 시 5개 Few-shot 모두 박기.

---

## 2026-05-03 새벽: 임포트 형식 다양성 + 화자 처리 결정

### 결정 14: 화자 혼합 처리 = 단일 페르소나 + speaker_mixed 플래그

- **일시**: 2026-05-03
- **맥락**: 학생 본인 라벨(`[(실제 학생) 학생]`)에 학부모가 대신 메시지 보내는 케이스 발견. 헤더 라벨과 실제 화자 정체성이 다름. 어떻게 처리할지.
- **선택지**:
  - (a) 메시지별 화자 분류 + 다중 페르소나 추출 (학생 + 학부모 둘 다)
  - (b) 단일 페르소나, 라벨대로 추출, 노이즈 메시지 무시
  - (c) 단일 페르소나 + speaker_mixed 플래그 + 메시지별 화자 분류 결과 첨부
- **결정**: (c) 단일 페르소나 + speaker_mixed 플래그
- **근거**:
  1. 1주차 DB 스키마(1 conversation = 1 persona) 변경 X
  2. AI 자동 분류 결과를 사용자가 검증 (안전장치)
  3. 페르소나 만들기 화면에서 "어느 화자로 페르소나 만들지" 사용자가 선택
  4. 학생 본인 페르소나는 1주차 스코프 밖이어도 추후 확장 자연스러움
- **응답 스키마 영향**:
  ```json
  {
    "persona": {
      "speaker_mixed": false | true,
      "speaker_classification": null | [
        { "message_index": 0, "inferred_speaker": "parent" },
        { "message_index": 1, "inferred_speaker": "student" }
      ]
    }
  }
  ```
- **트레이드오프**: 페르소나 만들기 화면 UX 추가 (혼합 감지 시 화자 선택 UI).
- **재검토 트리거**: 학생 페르소나 추출 요구 1회 이상 언급 시 다중 페르소나 스키마 재검토.
- **연결 작업**: 다음 세션 docs A에서 시스템 프롬프트에 화자 분류 단계 명시 + 페르소나 만들기 화면 docs(별도)에서 UX 반영.

### 결정 15: 자유 형식 임포트 시 relationship_type = 사용자 결정

- **일시**: 2026-05-03
- **맥락**: 사내 교원 메신저 같은 자유 형식 임포트 지원 요청. 페르소나 추출 대상이 학부모가 아닐 수 있음 (동료 교사 등). 1주차 1차 사용자는 학부모 페르소나만 만들 거지만, 자유 형식 임포트 자체는 지원 필요.
- **선택지**:
  - (a) 자유 형식이면 relationship_type을 AI가 자동 추론
  - (b) 자유 형식이면 relationship_type을 null로 두고 사용자가 결정
  - (c) 자유 형식은 1주차 미지원
- **결정**: (b) null로 두고 사용자 결정
- **근거**:
  1. 핸드오프에 이미 박혀 있음: "1주차 'parent' 고정, 미래 colleague/external 확장 대비"
  2. 자유 형식 임포트는 PMF 핵심 (선생님들이 쓸만한 메신저 다 지원)
  3. 1주차에는 사용자가 페르소나 만들기 화면에서 'parent' 기본값으로 진행. 다른 타입은 추후 확장
  4. AI 자동 추론은 colleague vs external vs parent 구분 신뢰도 낮음
- **응답 스키마 영향**: 자유 형식일 때 `persona.relationship_type = null` 또는 AI가 단순히 'parent' 기본값으로 박지 않고 null로 둠. 라우트 또는 페르소나 만들기 화면에서 사용자 선택 또는 기본값 적용.
- **연결 작업**: 다음 세션 docs A에서 시스템 프롬프트에 "자유 형식이면 relationship_type을 null로" 명시.
- **후속 작업 후보**: personas 테이블 relationship_type NOT NULL 제약 확인. NOT NULL이면 별도 마이그레이션으로 NULL 허용 처리.

---

## 2026-05-03 오후: Few-shot 가명 표기 정책 (docs A-1 산출물)

### 결정 16: Few-shot input 식별자에 `(가명)` 명시 표기 + 영구 정책

**배경**: docs A-1(2026-05-03 오후)에서 페르소나 추출 본 구현 1단계 작업 중, Few-shot 학습 예시의 input에 박을 식별자(학생 본명·학교명·병원명 등)를 어떻게 처리할지 결정 필요.

원본 데이터: Hans 로컬에 있는 실제 학부모 메시지. 그대로 git에 박으면 PII 위험.

**검토한 옵션 (세션 중 변경 흐름)**:

1. 자연스러운 한국 이름으로 가명화 (학생만): 민준, 하늘초등학교, 한빛병원
   - 우려: 검색 결과 "한빛병원" 등 실존 동명 의료기관 다수 발견. 평판/오해 위험.
2. 가상 시나리오 (처음부터 100% 가짜): 시나리오 자체를 새로 짜기
   - 기각: Hans 판단 — 시나리오 퀄리티 보장 못함 + 작성 자체가 일 (스코프 확장).
3. 명백한 더미 ("테스트1", "가나다"): LLM이 placeholder로 학습 → 실제 사용자 임포트의 한국 이름 마스킹 정확도 떨어짐.
4. **`(가명)` 명시 표기 (채택)**: 식별자 뒤에 `(가명)` 박음. 사람 독자 오해 차단 + 시스템 프롬프트로 LLM 헷갈림 방지.

**결정**: 옵션 4 채택. Few-shot input의 모든 식별자(학생 본명·학부모 자칭·학교명·병원명)에 `(가명)` 표기 명시.

**가명 매핑 (Few-shot 1, docs A-1)**:
- (실제 학생 본명) → 김민준(가명)
- (실제 학부모 자칭) → 민준엄마(가명)
- (실제 학교명) → 하늘초등학교(가명)
- (실제 병원명) → 한빛병원(가명)

**LLM 헷갈림 방지**: 시스템 프롬프트(src/lib/persona/system-prompt.ts)에 ## Few-shot 예시의 `(가명)` 표기 처리 섹션 추가. 4개 처리 규칙 명시:
1. 마스킹 대상은 식별자 단어 자체. `(가명)` 표기는 매핑 처리에서 제외.
2. output 어디에도 `(가명)` 표기 포함 금지.
3. metadata 추출 시 `(가명)` 표기 제거.
4. 실제 사용자 임포트에는 `(가명)` 등장하지 않음.

**적용 범위**:
- Few-shot input 5개(docs A-1: 1개, docs A-2: 4개 예정)에만 박힘.
- 실제 사용자 임포트 / output / DB / 화면 어디에도 등장 X.
- Few-shot이 운영에서도 유지되므로 결과적으로 영구 정책.

**docs A-2 이후 적용 의무**: Few-shot 4개 추가 시 동일 정책 적용. 가명 매핑은 각 Few-shot마다 docs A-2에서 명시.

**원본 식별자 git 박힘 금지 정책**: decision_log·docs·코드 어디에도 실제 학생 본명·학부모 자칭·학교명·병원명을 박지 않음. 가명 매핑 표 작성 시 원본 자리에는 "(실제 ...)" 자리표시자만 사용. 이 정책은 docs A-1 작업 중 PII 누출 사고(86e4e48 commit, amend로 e743060로 교체)로 학습된 가드.

**왜 이 결정이 흔들림 패턴 가드 사례인가**: 처음 옵션 1(자연스러운 이름)을 빠르게 채택했다가 Hans의 "실존 동명 기관 위험" 지적으로 검색 점검 → 옵션 2/3 검토 → 옵션 4 최종 채택. 추가로 옵션 4 작성 과정에서도 가명 매핑 표에 원본을 박는 자기모순이 발생 → Hans의 "이거 깃에서 보이는건 아니지?" 지적으로 검증 → amend 처리. PMF 핵심(페르소나 품질) 보존하면서 PII 위험 최소화한 절충점 도출. 사용자 영역(실제 학습 데이터 퀄리티)과 claude.ai 영역(정책 일관성/LLM 동작) 분리 의사결정의 좋은 예.

### 결정 17: speaker_mixed 정의 명시화 (교사 메시지 무관)

**일자**: 2026-05-04

**배경**:
- 페르소나 추출 본 구현 첫 수동 테스트(2026-05-04)에서 12번 체크리스트 FAIL.
- 시스템 프롬프트의 `speaker_mixed` 정의가 결정 14 의도와 어긋남.
- 기존 정의: "학부모 외 발신자(학생 등) 메시지가 섞이면 true" → 교사 메시지도 포함되어 false 케이스에서 잘못 true 반환.

**결정**:
- `speaker_mixed`는 페르소나 추출 대상(학부모 메시지)을 다른 발신자(학생) 메시지와 **구분 가능한지**만 표기.
- 교사 메시지가 함께 있는 것은 **무관** (라벨로 분리되어 학부모 메시지만 골라낼 수 있으면 false).
- true/false 케이스 각각을 시스템 프롬프트에 명시적으로 분리 서술.

**반영 위치**:
- `src/lib/persona/system-prompt.ts` 1단계 화자 분류 섹션 (commit a19d0d2)

**검증**:
- 2026-05-04 재테스트에서 12번 체크리스트 PASS 확인. 회귀 0건.

**연관 docs**:
- 작업 docs A-1.1: `docs/2026-05-04-persona-extraction-A-1-1.md`

### 결정 18: 라벨 보존 + 첨부 콘텐츠 처리 정책

**일자**: 2026-05-04

**배경**:
- 첫 수동 테스트(2026-05-04)에서 다음 두 동작이 관찰됨:
  1. 모델이 hitalk 라벨(`[이름 학부모 (자칭)][HH:MM]`)을 마스킹하지 않고 보존
  2. 모델이 첨부 공유 콘텐츠 본문을 `[첨부 파일]`로 마스킹 (시스템 프롬프트 규칙은 "파일명"이라고만 명시했으나 본문도 마스킹)
- 두 동작 모두 PMF 관점에서 바람직 → 정책으로 채택.

**결정**:
- **라벨 보존 정책**: 발신자 라벨은 메타 정보로 그대로 보존. 라벨 안의 식별자도 라벨의 일부로 간주하여 보존. 마스킹은 메시지 본문 안의 식별자에만 적용.
- **첨부 콘텐츠 처리 정책**: 첨부 사진/파일/공유 메시지의 본문은 학부모 발화가 아니므로 페르소나 분석 대상이 아님. `[첨부 사진]` 또는 `[첨부 파일]`로 마스킹. 첨부 메타 표기(`(하이톡 공유 / ...)`, `[사진 1장]` 등)는 보존, 그 안의 본문만 마스킹.

**반영 위치**:
- `src/lib/persona/system-prompt.ts` 2단계 비식별화 섹션 (라벨 보존 규칙 신규 + 첨부 처리 항목 보강)
- `src/lib/persona/few-shots.ts` Few-shot 2~5 (라벨 보존 + 첨부 처리 패턴 학습)

**검증**:
- docs A-2 작업 끝낸 후 수동 재테스트로 라벨 보존 + 첨부 처리 동작 확인.

**연관 docs**:
- 작업 docs A-2: `docs/2026-05-04-persona-extraction-A-2.md`

### 결정 19: personas 테이블 재생성 + AI 추출 결과 저장 정책

**일자**: 2026-05-04

**배경**:
- 페르소나 추출 본 동작 검증 완료(docs A 계열).
- 기존 personas 테이블(20260502000001)은 stub 시점 스키마. AI 추출 결과 저장에 부적합:
  - speaker_mixed, speaker_classification_note, metadata 컬럼 부재
  - relationship_type NOT NULL이라 AI 추출의 nullable과 충돌
  - traits, anonymized_conversation이 nullable이라 AI 추출 결과(항상 존재)와 부적합
- 1주차 PMF 단계 + personas 테이블 데이터 0건 확인 → DROP + CREATE 채택 (P-C)

**결정**:
- 기존 테이블 DROP CASCADE + 새 스키마 CREATE
- 새 컬럼: speaker_mixed, speaker_classification_note, metadata
- nullable 변경: relationship_type (NOT NULL → nullable + check), traits/anonymized_conversation (NOT NULL로 강화)
- 기존 정책 유지: soft delete (deleted_at), set_updated_at() 트리거 함수 재사용, idx_personas_user_id_active 인덱스
- name/summary는 nullable 유지 (1주차에 AI 미생성, 클라이언트에서 사용자 입력)
- RLS: 모든 작업(SELECT/INSERT/UPDATE/DELETE) 본인 데이터만. service_role bypass 없음.
- 응답 형식: persona_id를 ExtractResponse 필드와 같은 레벨(flat)로 반환.

**반영 위치**:
- `supabase/migrations/20260504000001_recreate_personas_table.sql` (신규)
- `src/lib/persona/save.ts` (신규)
- `src/app/api/personas/extract/route.ts` (수정 — DB 저장 통합)
- `src/lib/persona/schema.ts` (수정 — ExtractAPIResponseSchema 추가)
- 타입 파일 (위치는 Hans 환경에 따라)

**연관 docs**:
- 작업 docs B: `docs/2026-05-04-persona-db-save-B.md`

**미래 확장 여지**:
- relationship_type의 colleague/external은 1주차에 미사용. docs A-4 시점에 직장인 케이스 학습 시 활성화.
- name, summary는 1주차에 NULL. 클라이언트 화면 작업 시 입력 흐름 추가.

### 결정 20: 어뷰징 방지 정책 (거부 응답 + rate limiting)

**일자**: 2026-05-04

**배경**:
- 인증된 사용자가 conversation 필드에 학부모-교사 대화 외 텍스트(코딩 질문, 일상 잡담 등)를 넣어 Sonnet 4.6을 무료 GPT 대체로 사용할 위험.
- PMF 단계라 사용자 수 적지만 정책으로 박아둘 가치.

**결정**:
- **시스템 프롬프트**: "학부모-교사 대화로 인식되지 않으면 거부" 명시. 거부 시 `{rejected: true, reason: "..."}` 형태로 응답.
- **거부 통과 기준**: 학부모/학생/교사 라벨 OR 학부모 발화 추정 어미 OR 자녀 호칭 OR 학교/학급/교사 호칭 맥락 중 하나 이상.
- **거부 응답 HTTP**: 400 + `{success: false, error: "..."}`.
- **Rate limiting**: 사용자당 분당 10회 sliding window (`src/lib/ratelimit.ts` 본 구현 정책 유지). 위반 시 429.
- **Sanitization**: null bytes 제거, 50줄 이상 연속 빈 줄 정리 (가벼운 가드).
- **1주차 한정**: 학부모-교사 대화만 통과. 직장인/동료 교사 케이스는 docs A-4로 미룸.

**반영 위치**:
- `src/lib/persona/system-prompt.ts` (수정 — 어뷰징 거부 케이스 명시)
- `src/lib/persona/schema.ts` (수정 — RejectedResponseSchema 추가)
- `src/lib/persona/extract.ts` (수정 — 거부 분기)
- `src/app/api/personas/extract/route.ts` (수정 — rate limit + sanitization + 거부 시 400)

**연관 docs**:
- 작업 docs B: `docs/2026-05-04-persona-db-save-B.md`

**검증**:
- docs B 작업 후 수동 테스트: 정상 학부모 대화(통과 기대) + 코딩 질문 입력(거부 기대) + 일상 잡담 입력(거부 기대).
