# 메모리 갱신: 작업 A/B 결정 기록 + 세션 핸드오프 (2026-05-02 늦은밤)

> **작업 범위**: `.claude/memory/decision_log.md`, `.claude/memory/session_handoff.md` 두 파일 갱신
> **예상 시간**: 15~20분
> **선행 작업**: 작업 B 완료 + push 완료 (`a608670..83970d6` origin/main 반영)

---

## 0. 이 작업의 본질

**핵심**: 오늘 세션의 모든 결정과 끝점을 메모리 파일에 기록해서 다음 세션이 컨텍스트 단절 없이 이어갈 수 있게 한다.

이번 세션에서 다룬 것:
- 작업 A: connection test 임시 라우트 제거 (커밋 77965ed)
- 작업 B: 페르소나 추출 API Route 골격 + rate limiter (커밋 5b95f7a)
- docs 커밋 (커밋 83970d6)
- 좀비 프로세스 사고 (PID 46160, 31816 — port 3000/3001 점유 → 정리 완료)
- PowerShell 클립보드 사고 (Claude Code 명령 복사 시 쿠키 클립보드 덮어쓰임)

위 다섯 가지 모두 메모리에 박아야 다음 세션에서 같은 실수 반복 안 함.

---

## 1. 작업 단계 (Claude Code, 단계별 보고 + 컨펌)

### 단계 1: 기존 메모리 파일 상태 확인

다음 두 파일을 읽고 현재 내용 보고:
- `.claude/memory/decision_log.md`
- `.claude/memory/session_handoff.md`

각 파일의 마지막 엔트리가 언제인지, 어떤 형식으로 작성됐는지 확인. 새 엔트리를 그 형식에 맞춰 추가해야 함.

**중단 조건**: 파일이 없거나 형식이 크게 다르면 보고하고 멈춤.

### 단계 2: `decision_log.md` 갱신안 작성

기존 형식에 맞춰 새 엔트리 추가. 최소한 다음 결정들을 기록 (한국어, 간결하게):

#### 결정 1: Rate limiter 도입 시점 (정책 #9 활성화)

- **시점**: 2026-05-02 늦은밤, 페르소나 추출 API Route 골격 작업 중
- **결정**: 정책 #9 (rate limiting)을 이번 작업에서 활성화
- **근거**: Anthropic API 본격 사용 시점이 다음 세션이고, 이번 라우트가 그 첫 사용처가 될 예정. 라우트 골격 만들 때 같이 박아두는 게 자연스럽고, 다음 세션에서 Anthropic 호출 추가 시 즉시 보호 작동
- **이전 결정 참조**: 이전 decision_log에 "rate limiter는 Anthropic API 도입 시점까지 미루기"로 기록된 항목이 이번 작업으로 해소됨

#### 결정 2: Rate limiter 구현 방식 — Upstash Redis

- **선택**: `@upstash/ratelimit` + `@upstash/redis` (외부 서비스)
- **대안 검토**:
  - Supabase 테이블 기반: 보일러플레이트 많음 (테이블 + 트랜잭션 + cleanup + RLS), 1주차 임시 안전장치를 비즈니스 DB와 섞기 부적절
  - 메모리 기반: Vercel 서버리스에서 인스턴스마다 카운트 따로 돌아 사실상 무력화 → 즉시 탈락
- **선택 근거**: Vercel + Next.js 서버리스에서 사실상 표준, 무료 티어 10K command/day로 1주차 충분, 폐기 비용 낮음 (env만 빼면 비활성화)

#### 결정 3: Rate limit 값 — 10 req / 1분 / 사용자

- **알고리즘**: Sliding window (고정 window보다 burst 방어 강함)
- **키 단위**: 사용자 ID (`user.id`)
- **prefix**: `@dadmda/ratelimit` (Upstash DB 다른 앱과 충돌 방지, 미래 다른 ratelimit 추가 시도 안전)
- **근거**: 페르소나 추출은 1번 추출 후 결과 검토에 분 단위 소요, 정상 사용자가 1분에 10번 이상 호출할 일 없음. 봇 차단에 충분
- **조정 가능성**: 다음 세션에서 실제 사용 패턴 보면서 조정. 1주차엔 코드 상수, 미래에 env로 분리 가능

#### 결정 4: API Route 응답 형식 일관성

- **현 상태**: stub 응답이 `{ ok: true, message: "..." }`로 다른 응답들의 `{ success, error }` 패턴과 미세하게 어긋남
- **이번 세션 결정**: 그대로 둠. 다음 세션에서 실제 추출 로직 추가 시 자연스럽게 정리
- **다음 세션 액션 아이템**: stub 자리를 실제 추출 결과로 교체할 때 `{ success: true, data: {...} }` 형태로 통일

#### 결정 5: conversation 입력 검증 강화 시점

- **현 상태**: `typeof === "string" && length >= 1`만 체크 (공백만 있어도 통과)
- **이번 세션 결정**: 그대로 둠. 다음 세션에서 본격 검증 (최소 길이, trim, 비식별화 사전 체크 등) 추가
- **다음 세션 액션 아이템**: `conversation.trim().length >= N` 형태로 강화

#### 결정 6: 수동 테스트 (단계 6) 스킵

- **결정**: docs상 선택 항목인 4케이스 통합 테스트를 스킵
- **근거**: PowerShell에서 인증 쿠키 다루는 비용이 높음 (Claude Code 명령 복사할 때마다 쿠키 클립보드 덮어쓰는 사고 반복). 빌드 통과 + 코드 직접 검토로 골격 검증 충분 판단. 다음 세션에서 Anthropic 호출 추가 시 자연스럽게 통합 검증
- **위험 평가**: 골격 자체에 문제 있으면 다음 세션 첫 호출 시 즉시 발견됨. 위험 낮음

#### 결정 7: docs 커밋 분리

- **패턴**: 코드 커밋(`feat:`, `chore:`)과 프롬프트 docs 커밋(`docs:`) 분리
- **근거**: 작업 A의 `chore: connection test 라우트 제거` 커밋도 코드만 들어갔음. 패턴 일관성. docs untracked 부채 누적 방지
- **이번 세션 적용**: 작업 A/B의 docs 2개를 묶어서 단일 `docs:` 커밋(83970d6)으로

### 단계 3: `session_handoff.md` 갱신안 작성

기존 핸드오프(2026-05-02 저녁)를 **2026-05-02 늦은밤** 시점으로 갱신. 다음 사항을 명확히 박을 것:

#### 갱신할 핵심 정보

- **마지막 작업 시점**: 2026-05-02 늦은밤
- **푸시 상태**: origin/main이 83970d6까지 동기화됨 (a608670..83970d6 push 완료)
- **완료된 작업**:
  - 작업 A: connection test 임시 라우트 제거 (77965ed)
  - 작업 B: 페르소나 추출 API Route 골격 + rate limiter (5b95f7a)
  - docs 커밋 (83970d6)
- **새로 추가된 코드 자산**:
  - `src/lib/ratelimit.ts` (Upstash 기반 rate limiter)
  - `src/app/api/personas/extract/route.ts` (POST stub, 인증 + rate limit + 검증)
  - `src/types/env.d.ts`에 Upstash 변수 2개 추가
  - `package.json`에 `@upstash/ratelimit`, `@upstash/redis` 추가
- **새로 추가된 외부 자원**:
  - Upstash Redis DB: `dadmda-ratelimit` (Tokyo, Free Tier)
  - `.env.local`에 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 박힘 (사용자가 직접)

#### 다음 세션 시작 시 첫 작업

다음 세션의 자연스러운 다음 단계는 **페르소나 추출 본 로직 구현**이다. 구체적으로:

1. **페르소나 추출 프롬프트 설계** (Anthropic API 호출용)
2. **비식별화 로직 통합** (가림: 학생/학부모 본명, 전화번호, 주소, 병원/병명, 다른 학생; 보존: 날짜/시간, 학교/학년/반, 톤/감정)
3. **DB 저장** (personas 테이블 INSERT)
4. **stub 응답 → 실제 추출 결과로 교체** (응답 형식 `{ success: true, data: {...} }`로 일관성 정리)
5. **conversation 입력 검증 강화** (trim, 최소 길이)
6. **모델 선택 결정**: Haiku 4.5 vs Sonnet 4.6 (비용/품질 트레이드오프, 결정 누적 필요)

위 작업은 한 세션에 다 들어가지 않을 가능성이 큼. claude.ai에서 작업 단위 분할 결정이 첫 번째 단계.

#### 미리 준비하면 좋을 것

- 배우자에게 받은 학부모 메신저 대화 샘플 1개 (실제 또는 가상). 페르소나 추출 프롬프트 검증할 때 즉시 필요
- 없으면 claude.ai에서 가상 샘플 만들어서 진행 가능

#### 알려진 제약 / 주의사항 (이번 세션에서 학습한 것 추가)

##### 좀비 프로세스 패턴 (오늘 발견)

- **현상**: dev 서버 띄울 때 `Port 3000 is in use, trying 3001 instead` 메시지 + 의도치 않은 포트(3002 등)에서 실행. 브라우저로 3000번 접속하면 좀비 서버가 응답해서 500 에러 등 이상 동작
- **진단**: `netstat -ano | findstr :3000` 으로 LISTENING 줄의 PID 확인
- **해결**: `taskkill /PID <번호> /F`로 강제 종료
- **예방**: 세션 종료 시 dev 서버 Ctrl+C로 정리. 시스템 재시작 안 한 상태에서 이전 세션 잔재 의심

##### PowerShell 클립보드 사고 패턴 (오늘 발견)

- **현상**: API 테스트 시 인증 쿠키를 클립보드에 담아두고 Claude Code 명령을 복사하는 순간 쿠키 클립보드가 덮어씌워짐
- **결과**: `Get-Clipboard`가 PowerShell 명령어 자체를 가져와서 변수에 박힘
- **회피 방법**: (1) PowerShell 명령은 직접 타이핑 또는 메모장 경유 복사, (2) Notepad 활용해서 한 번에 옮기기, (3) DevTools에서 쿠키 셀 더블클릭 후 `Ctrl+A`로 셀 안에서만 선택
- **다음 세션 영향**: 수동 API 테스트가 필요해질 시점에 이 사고 다시 발생 가능. Thunder Client (VS Code 확장) 도입 검토 필요

##### dev 서버 첫 부팅 시점 표준 점검 (제안)

- 매 세션 첫 dev 서버 부팅 시 출력에서 `Local: http://localhost:3000` 확인
- `trying 3001 instead` 메시지 보이면 즉시 좀비 프로세스 점검

#### 환경 / 키 상태 (변동 없음, 재확인용)

- Supabase 프로젝트: `dadmda` (Seoul)
- Anthropic API 키: 발급 완료, `.env.local`에 박힘, $20/월 한도
- **Upstash Redis 키 (이번 세션 추가)**: `dadmda-ratelimit` (Tokyo, Free Tier 10K cmd/day), URL/TOKEN `.env.local`에 박힘
- GitHub: `HAAN6892/dadmda` (private), origin/main이 83970d6까지 동기화

### 단계 4: 두 파일 갱신안 보고 + 사용자 컨펌

단계 2, 3에서 작성한 내용을 각각 통째로 보고. 사용자가 검토하고 수정 요청 가능.

**컨펌 받기 전까지 파일 수정하지 말 것.**

### 단계 5: 파일 수정 적용

사용자 컨펌 후 두 파일에 실제 내용 반영. 기존 내용은 보존하고 새 엔트리를 적절한 위치에 추가 (보통 파일 상단 또는 하단, 기존 형식에 맞춰).

### 단계 6: 빌드 검증 (생략 가능)

메모리 파일은 .md라 빌드 영향 없음. `npm run build` 생략 OK. 단 git status로 의도 외 파일 변경 없는지만 확인.

### 단계 7: 커밋 메시지 제안

```
chore(memory): 작업 A/B 결정 기록 + 세션 핸드오프 갱신

- decision_log.md: rate limiter 도입 결정 7개 추가
  (정책 #9 활성화, Upstash 선택, 10req/1분, 응답 형식, 입력 검증, 테스트 스킵, docs 분리)
- session_handoff.md: 2026-05-02 늦은밤 시점으로 갱신
  (작업 A/B 완료, Upstash 추가, 좀비 프로세스 + PowerShell 클립보드 학습 박음)
```

### 단계 8: 커밋 (사용자 컨펌 후)

1. `git add .claude/memory/decision_log.md .claude/memory/session_handoff.md` (두 파일만)
2. `git commit` (위 메시지)
3. **`git push` 절대 실행 금지**
4. 커밋 해시 보고
5. `git status`로 clean 상태 확인

---

## 2. 보안 정책 점검

- [ ] **`.env.local`** Read/Grep 금지 (메모리 파일에 키 값 박혀있는지 의심되더라도 절대 접근 X)
- [ ] **decision_log에 비밀번호/토큰/API 키 절대 박지 않기** — Upstash 키, Anthropic 키, Supabase DB 비번 모두 키 자체는 기록 X. "박혔다"는 사실만 기록
- [ ] **session_handoff에도 동일** — 키 존재 여부와 한도(예: $20/월)만 기록, 값 자체는 X

---

## 3. 흔들림 패턴 감시

- "이 김에 다른 메모리 파일도 정리하자" → 스코프 확장
- "decision_log에 결정 더 풍부하게 기록하자" → 메타 프로젝트 도피 (지금 7개로 충분)
- "session_handoff 형식을 더 좋게 리팩토링하자" → 메타 프로젝트 도피
- 메모리 파일 수정하다 다른 .claude/agents/ 파일도 같이 손대려는 충동 → 스코프 확장
- 빌드/테스트 에러를 보고 없이 즉시 고치려는 충동 → 즉시 수정 충동

---

## 4. 완료 기준

- [ ] `.claude/memory/decision_log.md`에 결정 7개 추가됨
- [ ] `.claude/memory/session_handoff.md`이 2026-05-02 늦은밤 시점으로 갱신됨
- [ ] git status clean
- [ ] 커밋 완료 (push는 사용자가 결정)
- [ ] 단계별 보고 모두 사용자 컨펌 받음

---

## 5. 이 작업이 끝나면

claude.ai 채팅으로 돌아가서 다음 보고:

1. 갱신된 두 파일의 핵심 변경점 요약 (3~5줄)
2. 커밋 해시
3. push 진행 여부 (사용자 결정)

그러면 claude.ai에서 세션 종료 또는 다음 작업 단위 결정.
