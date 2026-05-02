# 다듬다 프로젝트 핸드오프 (2026-05-03 새벽 시점)

> 새 claude.ai 채팅에 이 파일 통째로 첨부하거나 복붙해서 시작.
> 이전 핸드오프(2026-05-02 23시 시점) 내용을 누적해서 갱신한 버전.

---

## 0. 워크플로우 (계속 유지)

### 역할 분담
- **claude.ai (너)** = 기획·설계·디버깅 (두뇌)
- **Claude Code (로컬 터미널)** = 코드 수정·실행·커밋 (손)
- **사용자(Hans)** = 전달자 + 컨펌 게이트 (신경)

### 표준 사이클
```
[1] claude.ai에서 기획/논의
   ↓
[2] claude.ai가 .md 프롬프트 파일 생성 (present_files)
   ↓
[3] ✋ 사용자 검토/컨펌
   ↓
[4] 로컬 docs/ 폴더에 저장
   ↓
[5] Claude Code에 "docs/파일명.md 읽고 실행해" 지시
   ↓
[6] Claude Code 실행 (코드 수정/커밋)
   ↓
[7] ✋ 사용자 변경사항 확인
   ↓
[8] 결과를 claude.ai로 복붙
   ↓
[1]로 회귀
```

### 프롬프트 .md 작성 규칙
1. 채팅 인라인 코드블록 ❌
2. **하나의 통 .md 파일**로 생성
3. `present_files`로 전달
4. 파일명: `docs/2026-MM-DD-기능명.md`

### 컨펌 게이트
| 시점 | 컨펌 내용 |
|---|---|
| 프롬프트 .md 생성 후 | 작업 범위, 접근 방식 검토 |
| 보안 정책 충돌 시 | CLAUDE.md 정책 #12 등 |
| 흔들림 패턴 감지 시 | 6가지 패턴 |
| API 호출 비용 발생 시 | Anthropic API |
| 배포 직전 | 무조건 수동 |
| Git push | 무조건 수동 (Claude Code 절대 X) |

### 메모리에 박힌 룰 (claude.ai)
- **Claude Code에 전달할 프롬프트는 항상 코드블록(```)으로 감싸서 제공**. 사용자가 복사 버튼으로 그대로 전달함.

---

## 1. 프로젝트 핵심 (변경 없음)

- **개념**: 한국 초등교사가 학부모 메신저 대화를 임포트하면, AI가 페르소나 추출·비식별화하고 4축(격식·공감·단정·길이) 영점조절로 메시지 다듬어주는 웹 도구
- **1차 타깃**: 배우자(초등교사). 검증 후 PM·의료진 등 확장
- **1주차 화면 4개**: 로그인 / 홈(페르소나 그리드) / 페르소나 만들기 / 메시지 작성

---

## 2. 기술 스택 (Upstash 추가)

- Next.js 14 (App Router) + TypeScript + Tailwind 3.4
- **shadcn/ui** (new-york + stone, 9개 컴포넌트 + sonner)
- **Anthropic SDK** (`@anthropic-ai/sdk@^0.92.0`, 키 발급 완료)
- **Supabase** (Seoul) + **Supabase CLI 2.95.4** (Scoop 설치, link 완료)
- **Upstash Redis** (`@upstash/ratelimit` + `@upstash/redis`, Tokyo 리전, rate limiter 전용)
- Vercel 배포 예정 (1주차 후반)
- GitHub: HAAN6892/dadmda (private)
- 로컬 작업 폴더: `C:\Users\jj689\projects\dadmda`

---

## 3. 사용자 / 작업 방식

- PM 4년차, 코딩 중급 (개발자 수준 X)
- 80% Claude Code 직접 / 20% Claude 데스크톱 검토
- 모델: Opus 4.7
- 응답 언어: 한국어, 짧지 않게, 끊지 말고
- **응답 톤: 평가/칭찬 없이 사실 기반**
- Git push는 항상 사용자가 직접
- Claude Code는 단계별 보고 후 사용자 확인 받고 진행
- **기술 결정은 claude.ai에 위임**. 사용자(PM)는 사용자 행태/UX 관점만 결정
- **이 채팅 안에서 ID/식별자 노출은 OK** (외부 공유 안 함). API 키/비밀번호/토큰만 절대 노출 X

---

## 4. 흔들림 패턴 6가지 (계속 감시)

- **시장 넓히기**: 검증 안 끝났는데 PM/의료진 등 확장 이야기로 도피
- **메타 프로젝트 도피**: 본 작업 대신 도구·문서·에이전트 만들기로 회피
- **즉시 수정 충동**: 발견한 문제를 보고 없이 바로 고치려는 경향
- **스코프 확장**: "이 김에 ~도" 형태의 추가 작업 시도
- **우선순위 흐림**: 1주차 4개 화면 외 작업으로 빠지기
- **Next 16 업그레이드 등 인프라 메이저 작업 충동**

---

## 5. 오늘 (~2026-05-03 새벽) 완료한 작업 6개

| # | 작업 | 커밋 | 핵심 |
|---|---|---|---|
| 1 | shadcn/ui + ESLint 룰 | `197f285` | new-york + stone, 9개 컴포넌트, next/image 금지 룰 |
| 2 | Anthropic SDK + env | `46fd2fc` | SDK 설치, 클라이언트 유틸, connection test 통과 |
| 3 | Supabase CLI 셋업 | `e7df274` | Scoop 설치, CLI 2.95.4, 원격 link 완료 |
| 4 | personas 테이블 | `2bf0115` | 컬럼 11개 + RLS 4개 + 트리거 1개, 원격 적용 완료 |
| 5 | connection test 라우트 제거 (작업 A) | `77965ed` | `/api/test/anthropic` 삭제, 임시 코드 청소 |
| 6 | 페르소나 추출 API Route 골격 + rate limiter (작업 B) | `5b95f7a` | POST stub, 인증 가드 + rate limit + 입력 검증, Upstash 도입, 정책 #9 활성화 |

작업 A/B docs는 별도 커밋(`83970d6`)으로 분리. 작업 A/B/docs 커밋(77965ed, 5b95f7a, 83970d6)까지 모두 push 완료. origin/main이 83970d6까지 동기화됨.

API 비용 누적: 약 $0.00008 (connection test 1회). $20 한도 거의 그대로. 작업 B 단계에서는 Anthropic 호출 없음 (stub).

---

## 6. 1주차 데이터 모델 + 정책 결정 (확정)

### 데이터 구조
- **테이블 1개만**: `personas` (학부모 페르소나)
- 학생 그룹핑은 `student_label` 텍스트 컬럼으로 (1주차 단순화, 미래 students 테이블 분리 시 마이그레이션 단순)
- relationship_type 컬럼: 1주차 'parent' 고정, 미래 colleague/external 확장 대비
- traits jsonb (구조 자유도, 스키마는 추출 프롬프트 단계에서 확정)
- anonymized_conversation 누적 컬럼 (비식별화된 원본)
- Soft delete (deleted_at)

### 권한
- RLS 4개 정책 (SELECT/INSERT/UPDATE/DELETE) 모두 `auth.uid() = user_id`
- SELECT는 `deleted_at IS NULL` 추가
- 공유 X. 만든 교사 본인만 접근

### 비식별화 (다음 작업에서 구현)
**가림**:
- 학생 본명 (호칭은 페르소나 라벨로 보존)
- 학부모 본명, 전화번호, 주소
- 병원명, 병명 (의료 민감정보)
- 다른 학생 이름

**보존**:
- 날짜/시간 (약속 맥락)
- 학교/학년/반 정보
- 일반 대화 흐름, 톤, 감정 표현

**처리 흐름**:
```
[원본 대화 임포트]
  ↓
[Anthropic API에서 비식별화 + 페르소나 추출 동시]
  ↓
[비식별화된 버전만 DB 저장. 원본은 즉시 폐기]
```

**안전장치**:
- 페르소나 추출 결과를 사용자에게 보여주고 검토 단계 거침
- 비식별화 누락 발견 시 사용자가 "저장 안 함" 선택 가능
- AI 비식별화는 100% 정확하지 않다는 전제

### 페르소나 업데이트 정책
- AI 추출 결과를 사용자가 텍스트로 직접 수정 가능
- 새 대화 임포트 시 페르소나 갱신 가능
- 마음에 안 들면 다시 추출 (덮어쓰기, UI에서 경고)

### Rate limiter (작업 B에서 추가)
- 위치: `src/lib/ratelimit.ts` (Upstash Redis 기반)
- 제한값: 10 req / 1분 / 사용자, sliding window
- 키 단위: `user.id`, prefix `@dadmda/ratelimit`
- analytics: true (Upstash 콘솔에서 사용 패턴 관찰)
- 적용 라우트: `src/app/api/personas/extract/route.ts` (1주차 첫 적용처)

---

## 7. 새 세션 시작 시 첫 작업

### 다음 작업 단위 — 페르소나 추출 본 로직 구현

작업 B에서 골격(인증 + rate limit + 입력 검증 + stub)까지 완료. 다음은 stub 자리를 실제 로직으로 채우는 일.

구체 항목:

1. **페르소나 추출 프롬프트 설계** (Anthropic API 호출용 시스템 프롬프트 + 입출력 형식 정의)
2. **비식별화 로직 통합** — 가림: 학생/학부모 본명, 전화번호, 주소, 병원/병명, 다른 학생; 보존: 날짜/시간, 학교/학년/반, 톤/감정. 추출과 단일 호출에서 동시 처리
3. **DB 저장** — `personas` 테이블 INSERT (RLS는 이미 `auth.uid() = user_id` 강제)
4. **stub 응답 → 실제 추출 결과로 교체** — 응답 형식을 `{ success: true, data: {...} }`로 다른 라우트와 통일 (decision_log 결정 4)
5. **conversation 입력 검증 강화** — `trim().length >= N` 형태로 (decision_log 결정 5)
6. **모델 선택 결정** — Haiku 4.5 vs Sonnet 4.6 (비용/품질 트레이드오프, 결정 누적 필요)

위 작업은 한 세션에 다 들어가지 않을 가능성이 큼. claude.ai에서 작업 단위 분할 결정이 첫 번째 단계.

### 새 세션의 첫 응답 (claude.ai)

1. 핸드오프 이해 확인 한 줄
2. 위 6개 항목 중 첫 단위 작업 docs 작성 → present_files
3. 사용자 컨펌 후 Claude Code 실행 지시

---

## 8. 인프라 / 키 상태

- Supabase 프로젝트: `dadmda` (Seoul)
- Supabase URL/anon key: `.env.local`에 설정됨
- **Anthropic API 키**: 발급 완료, `.env.local`에 박힘 (사용자가 직접 박았고 Claude Code 컨텍스트에 노출 안 됨)
- Anthropic 콘솔 spending limit: 월 $20
- **Upstash Redis (작업 B에서 추가)**: DB 이름 `dadmda-ratelimit`, Tokyo 리전, Free Tier (10K command/day), TLS Enabled. `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` 두 키가 `.env.local`에 박힘 (사용자가 직접). Claude Code는 값 자체에 접근 안 함
- Database password: 사용자가 reset 후 안전한 곳에 보관 (Claude Code/채팅에 노출 안 됨)
- GitHub: `HAAN6892/dadmda` (private)
- Supabase CLI: Scoop으로 설치, 원격 link 완료, access token으로 모든 작업 가능 (비번 미요구 케이스 다수 확인)

---

## 9. `.claude/memory/` 보존 파일 (Claude Code가 새 세션에서 읽을 것)

- `project_push_policy.md` — push 정책 (1주차 한정)
- `feedback_workflow.md` — 단계별 보고·확인 워크플로
- `anti_drift_patterns.md` — 흔들림 패턴 6가지
- `security_policy_checklist.md` — 보안 정책 #12 자동 점검
- `decision_log.md` — **모든 의사결정 흐름 (작업 A/B 결정 7개 통합 엔트리 추가됨)**
- `session_handoff.md` — 이전 세션 종료 시점 (이 핸드오프)
- `workflow.md` — docs/ 폴더 기반 워크플로

---

## 10. 다음 세션 시작 시 사용자가 할 작업

### 환경 준비
```powershell
cd C:\Users\jj689\projects\dadmda
npm run dev
```

### 새 채팅에서 첫 응답
1. 이 핸드오프 파일 첨부
2. "다듬다 프로젝트 이어서. 이 핸드오프 읽고 시작" 한 줄

### 미리 준비하면 좋을 것 (선택)

다음 세션에서 페르소나 추출 본 로직 들어갈 때 필요한 것:

- **배우자한테 받아둘 수 있으면**: 학부모 메신저 대화 샘플 1개 (실제 또는 비슷한 가상 시나리오). 페르소나 추출 프롬프트 검증할 때 즉시 필요. 없으면 claude.ai에서 가상 샘플 만들어서 진행 가능

---

## 11. 알려진 제약 / 주의사항

### 보안
- API 키, DB 비번, 토큰: 절대 채팅/코드/git에 박지 않음
- Supabase Service Role Key: 1주차 미사용 (env에서 제외됨)
- next/image import 금지 (정책 #12, ESLint로 강제)
- Server Actions 금지 (정책 #12)

### CLI 동작 특이점 (decision_log.md 기록됨)
- supabase link, db push, migration list 모두 access token 기반 인증으로 비번 미요구
- Database password는 CLI 외 직접 접속(psql 등) 시에만 필요

### Claude Code 보안 사고 사례 (이전 세션 발견)
- 1단계 .env.local Grep 시 값까지 출력된 사고 → 자진 신고 → 보안 원칙 강화 (4단계 이후 .env.local 절대 Read/Grep 금지)
- 5단계 connection test 모델명 오타(`claude-3-5-haiku-20241022`) → 실제 정식 ID는 `claude-haiku-4-5-20251001` (Haiku 4.5)
- 보고 정확성 강화: 파일 인용은 100% 파일에서 직접 복사

### 좀비 프로세스 패턴 (이번 세션 학습)
- **현상**: dev 서버 띄울 때 `Port 3000 is in use, trying 3001 instead` 메시지 + 의도치 않은 포트(3001/3002 등)에서 실행. 브라우저로 3000번 접속하면 좀비 서버가 응답해서 500 에러 등 이상 동작
- **진단**: `netstat -ano | findstr :3000` 으로 LISTENING 줄의 PID 확인
- **해결**: `taskkill /PID <번호> /F`로 강제 종료
- **예방**: 세션 종료 시 dev 서버 Ctrl+C로 정리. 시스템 재시작 안 한 상태에서 이전 세션 잔재 의심
- **표준 점검**: 매 세션 첫 dev 서버 부팅 시 출력에서 `Local: http://localhost:3000` 확인. `trying 3001 instead` 보이면 즉시 점검

### PowerShell 클립보드 사고 패턴 (이번 세션 학습)
- **현상**: API 테스트 시 인증 쿠키를 클립보드에 담아두고 Claude Code 명령을 복사하는 순간 쿠키 클립보드가 덮어씌워짐. `Get-Clipboard`가 PowerShell 명령어 자체를 가져와서 변수에 박힘
- **회피 방법**:
  - PowerShell 명령은 직접 타이핑 또는 메모장(Notepad) 경유 복사
  - DevTools에서 쿠키 셀 더블클릭 후 셀 안에서만 `Ctrl+A`로 선택 (전체 페이지 선택 회피)
- **다음 세션 영향**: 수동 API 테스트가 필요해질 시점에 이 사고 다시 발생 가능. **Thunder Client (VS Code 확장) 도입 검토** 필요. GUI 도구가 클립보드 의존 없이 헤더·쿠키·반복 호출까지 한 곳에서 처리

### 사용 모델 (현재)
- Connection test (이미 라우트 삭제됨, 작업 A): `claude-haiku-4-5-20251001` (Haiku 4.5)
- 페르소나 추출 / 메시지 다듬기 본 기능: 다음 세션에서 결정 (Haiku 4.5 vs Sonnet 4.6, 비용/품질 트레이드오프)

---

## 12. 임시 코드 (다음 세션 정리 대상)

### 삭제 예정 파일
- 없음 — 이전 세션의 `src/app/api/test/anthropic/route.ts`는 작업 A로 제거 완료(`77965ed`). 현재 임시 라우트 잔재 없음

### 추가 예정 작업 (별도 docs로 분리됨, 변동 없음)
- `docs/2026-05-DD-login-shadcn-migration.md` — 로그인 페이지 native input/button을 shadcn으로 마이그레이션
- `docs/2026-05-DD-npm-audit-followup.md` — npm vulnerability 5건 (1 moderate, 4 high) 후속 처리. 작업 B에서 `@upstash/*` 추가 후에도 동일하게 5건 (1 moderate, 4 high) 보고됨. 추가 영향 없음

### 다음 세션 stub 정리 (작업 B 잔존)
- `src/app/api/personas/extract/route.ts`의 stub 응답 `{ ok: true, message: "..." }` → 실제 추출 결과 + 응답 형식 통일(`{ success: true, data: {...} }`)로 교체 (decision_log 결정 4)
- 동 파일의 conversation 검증 강화 (`trim().length >= N`, decision_log 결정 5)

---

**이 핸드오프 끝. 새 채팅에서 이 파일 첨부 또는 복붙해서 시작.**
