# 페르소나 추출 API Route 골격 + Rate Limiter 도입

> **작업 범위**: API Route 골격 + 인증 가드 + Upstash Rate limiter + 에러 핸들링 + 입력 검증
> **제외**: 실제 페르소나 추출 프롬프트, 비식별화 로직, Anthropic API 호출, DB 저장 (모두 다음 세션)
> **예상 시간**: 1시간
> **선행 작업**: 작업 A (`/api/test/anthropic` 삭제) 완료, 커밋 77965ed

---

## 0. 이 작업의 본질

**핵심**: "들어왔는데 인증 통과했고 rate limit 안 걸렸다"까지 검증하는 라우트 골격을 만든다. 실제 비즈니스 로직(추출/비식별화/저장)은 다음 세션 작업이라 stub으로 남긴다.

**왜 지금 rate limiter를 도입하나**:
- CLAUDE.md 보안 정책 #9 (rate limiting)는 Anthropic API 본격 사용 시점에 도입하기로 `decision_log.md`에 기록됨
- 이번 라우트가 그 첫 사용 시점이므로 정책 #9 활성화 타이밍
- 이번 세션에는 stub이지만 다음 세션에서 Anthropic 호출 추가 시 즉시 보호 작동해야 함

---

## 1. 사전 준비 (사용자가 먼저 해야 함, Claude Code는 대기)

### 1-1. Upstash 계정 + Redis DB 생성

사용자가 직접 진행:

1. https://upstash.com/ 가입 (GitHub OAuth 가능)
2. Console → Redis → Create Database
   - Name: `dadmda-ratelimit`
   - Region: `ap-northeast-1` (Tokyo, Seoul과 가장 가까움)
   - Type: Regional (Global은 1주차에 불필요)
   - TLS: Enabled
3. 생성된 DB 상세 페이지에서 다음 두 값 복사:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 1-2. `.env.local`에 키 추가

사용자가 직접 박음. Claude Code는 절대 `.env.local`을 Read/Grep/수정하지 않음.

```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### 1-3. 사용자가 claude.ai에 보고

위 두 단계 완료 후 claude.ai에 "Upstash 셋업 끝, env 박음" 보고. 그러면 Claude Code 작업 단계 시작.

---

## 2. 작업 단계 (Claude Code, 단계별 보고 + 컨펌)

### 단계 1: 패키지 설치 + 의존성 확인

1. 다음 패키지 설치:
   ```
   npm install @upstash/ratelimit @upstash/redis
   ```
2. `package.json`의 dependencies에 두 패키지 추가됐는지 확인
3. 설치 결과 + npm vulnerability 변동 보고
4. **사용자 컨펌 대기**

### 단계 2: 환경변수 타입 정의 추가

1. 기존 env 타입 파일 확인 (있으면 어디 있는지 보고)
2. 없으면 `src/types/env.d.ts` 또는 기존 패턴에 맞춰 생성
3. 다음 두 변수 타입 추가:
   - `UPSTASH_REDIS_REST_URL: string`
   - `UPSTASH_REDIS_REST_TOKEN: string`
4. **사용자 컨펌 대기**

### 단계 3: Rate limiter 유틸 작성

파일: `src/lib/ratelimit.ts` (또는 기존 lib 구조에 맞춰)

요구사항:
- Upstash Redis 클라이언트 + `@upstash/ratelimit` 인스턴스 생성
- Sliding window 방식 (고정 window보다 burst 방어 강함)
- **제한값: 10 req / 1분 / 사용자**
- 사용자 단위 키 (`user.id` 기반)
- 환경변수 누락 시 명확한 에러 (런타임 시작부터 죽도록)

작성 후:
1. 파일 경로 + 코드 보고
2. **사용자 컨펌 대기**

**중단 조건**: 만약 기존 코드에 비슷한 ratelimit 유틸이 이미 있으면 발견 즉시 보고하고 멈춤. 중복 생성 금지.

### 단계 4: API Route 골격 작성

파일: `src/app/api/personas/extract/route.ts`

구조 (의사코드):

```
POST handler:
  1. Supabase 서버 클라이언트로 현재 사용자 조회
     - 미인증 → 401 + "로그인이 필요합니다"
  2. Rate limiter 체크 (user.id 키)
     - 초과 → 429 + "잠시 후 다시 시도해주세요"
     - 응답 헤더에 X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset 포함
  3. 요청 body 파싱 + 검증
     - JSON 파싱 실패 → 400 + "요청 형식이 올바르지 않습니다"
     - 필수 필드: conversation (string, 1자 이상)
     - 검증 실패 → 400 + 구체적 에러 메시지 (한국어)
  4. STUB: { ok: true, message: "페르소나 추출 로직 미구현 (다음 세션)" } 반환 (200)
  5. 모든 단계에서 try/catch로 감싸고 예상 못한 에러는 500 + "서버 오류가 발생했습니다"
```

기존 패턴 정렬:
- `src/app/api/auth/send-otp/route.ts`, `verify-otp/route.ts`의 코드 스타일·에러 응답 형식 그대로 따라갈 것
- 입력 검증 라이브러리(zod 등)가 기존에 쓰이고 있으면 동일하게 사용. 없으면 수동 검증 (이번에는 단순하니까 OK)

작성 후:
1. 파일 경로 + 코드 보고
2. **사용자 컨펌 대기**

### 단계 5: 빌드 검증

1. `npm run build` 실행
2. 타입 에러 / 빌드 에러 없는지 확인
3. 라우트 목록에 `/api/personas/extract`가 추가됐는지 확인
4. 결과 전문 보고
5. **사용자 컨펌 대기**

**실패 시**: 에러 전문 그대로 보고. 임의 수정 금지.

### 단계 6: 수동 테스트 (선택, 사용자 환경에서)

claude.ai와 사용자가 협의 후 실행 여부 결정. Claude Code는 다음 케이스 테스트 시나리오만 보고하고 대기:

- 미인증 상태로 POST → 401 확인
- 인증 상태 + body 없이 POST → 400 확인
- 인증 상태 + 정상 body → 200 + stub 응답 확인
- 11회 연속 호출 → 11번째에 429 확인

테스트 도구는 사용자 선택 (curl, Thunder Client, Postman 등).

### 단계 7: 커밋 메시지 제안

```
feat: 페르소나 추출 API Route 골격 + rate limiter

- src/app/api/personas/extract/route.ts (POST, 인증 가드 + 입력 검증 + stub)
- src/lib/ratelimit.ts (Upstash Redis 기반, 10 req/1분/사용자)
- @upstash/ratelimit, @upstash/redis 의존성 추가
- 보안 정책 #9 (rate limiting) 활성화
- 실제 추출 로직은 다음 세션 작업
```

### 단계 8: 커밋 (사용자 컨펌 후)

1. `git add` (이번 작업 관련 파일만)
2. `git commit` (위 메시지)
3. **`git push` 절대 실행 금지**
4. 커밋 해시 보고

---

## 3. 보안 정책 점검 (CLAUDE.md)

- [ ] **#9 (rate limiting)**: 이번 작업으로 활성화. 라우트 안에 limiter 호출 박혀 있어야 함
- [ ] **#12 (next/image, Server Actions 금지)**: API Route 사용 (Server Action 아님), next/image 미사용 → OK
- [ ] **인증 가드**: Supabase Auth로 user 검증, 미인증은 401
- [ ] **에러 메시지**: 한국어, 내부 구현 노출하지 않음 (스택 트레이스 클라이언트로 안 흘림)
- [ ] **`.env.local`**: Read/Grep/수정 절대 금지

---

## 4. 흔들림 패턴 감시

이 작업 중 다음이 감지되면 **즉시 보고하고 멈추기**:

- "rate limiter 만든 김에 send-otp/verify-otp에도 적용하자" → 스코프 확장 (별도 작업)
- "이 김에 페르소나 추출 프롬프트도 작성해두자" → 스코프 확장 (다음 세션)
- "Anthropic API 호출까지 일단 박아두면 다음 세션 편할 듯" → 스코프 확장 + 즉시 수정 충동
- "zod 안 쓰는데 이 김에 도입하자" → 스코프 확장 (별도 결정 필요)
- "기존 send-otp/verify-otp 에러 핸들링이 좀 아쉬운데 같이 리팩토링" → 스코프 확장
- "Upstash 무료 티어 한도가 낮으니 좀 더 좋은 솔루션으로 갈아타자" → 시장 넓히기/메타 프로젝트 도피
- 빌드/테스트 에러를 보고 없이 즉시 고치려는 충동 → 즉시 수정 충동

---

## 5. 완료 기준

- [ ] `@upstash/ratelimit`, `@upstash/redis` 설치됨
- [ ] 환경변수 타입 정의 추가됨
- [ ] `src/lib/ratelimit.ts` 작성됨 (10 req/1분/user)
- [ ] `src/app/api/personas/extract/route.ts` 작성됨 (인증 + rate limit + 입력 검증 + stub)
- [ ] 빌드 성공
- [ ] 수동 테스트 4케이스 모두 통과 (선택)
- [ ] 커밋 완료 (push는 사용자가)
- [ ] 단계별 보고 모두 사용자 컨펌 받음

---

## 6. 이 작업이 끝나면

claude.ai 채팅으로 돌아가서 다음 보고:

1. 추가/수정된 파일 목록
2. 빌드 결과
3. 수동 테스트 결과 (실행했다면)
4. 커밋 해시
5. Upstash 무료 티어 사용량 (선택)

그러면 claude.ai에서 다음 작업 단위 결정:
- 페르소나 추출 프롬프트 설계
- 비식별화 로직 설계
- 또는 1주차 다른 화면 (홈 페르소나 그리드, 페르소나 만들기, 메시지 작성) 우선순위 재정렬

---

## 7. 참고: Rate limit 값 결정 근거

**10 req / 1분 / 사용자**:
- 페르소나 추출은 사용자 한 명이 1분에 10번 이상 호출할 일이 정상적으로 없음 (한 번 추출하면 결과 검토하는 데만 분 단위)
- 봇/스크립트 공격 차단에 충분
- 정상 사용자가 실수로 막히는 빈도 매우 낮음
- 다음 세션에서 실제 사용 패턴 보면서 조정 가능 (env 변수로 빼두면 편함, 다만 1주차엔 코드 상수로 충분)
