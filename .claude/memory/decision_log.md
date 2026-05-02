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
