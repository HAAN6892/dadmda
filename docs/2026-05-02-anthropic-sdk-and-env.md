# Anthropic SDK 셋업 및 환경변수 구성

## 컨텍스트

- 다듬다 1주차, shadcn/ui 셋업(2026-05-02) 완료 직후
- API 키 발급 완료 (이름: `dadmda-dev`, 콘솔 spending limit 월 $20 설정됨)
- 페르소나 추출 / 메시지 다듬기 두 메인 기능 모두 Anthropic API 사용 → SDK 통합 인프라가 모든 후속 작업의 토대
- 이번 작업은 **인프라 준비** 단위 (페르소나 기능 본 구현은 다음 단계 docs에서)

## 작업 목표 (체크리스트)

- [ ] Anthropic SDK 설치
- [ ] `.env.local` 파일 생성 (사용자가 직접 키 값 박음)
- [ ] `.env.local.example` 파일 생성 (협업용 템플릿)
- [ ] 환경변수 타입 정의 (TypeScript)
- [ ] Anthropic 클라이언트 유틸 함수 작성
- [ ] Connection test용 임시 API route 작성
- [ ] 검증 (typecheck, dev 서버, 실제 API 호출)
- [ ] 의사결정 로그 업데이트
- [ ] 커밋 (사용자가 push)

## 구현 가이드

### 1. Anthropic SDK 설치

```bash
npm install @anthropic-ai/sdk
```

설치 후 검증:
- `package.json` dependencies에 `@anthropic-ai/sdk` 추가됨
- 버전 명시 (예: `^0.30.0` 또는 그 시점 latest stable)

### 2. `.env.local` 파일 처리

**중요: Claude Code는 .env.local 파일에 직접 키 값을 박지 않는다.** 사용자가 직접 박을 것. Claude Code는 다음 작업만 수행:

(a) `.env.local` 파일이 이미 존재하는지 확인 (Supabase 키가 이미 박혀있을 것)
- 존재하면: 그대로 두고, 사용자가 추가할 줄(`ANTHROPIC_API_KEY=`)을 알려주기만 함
- 존재 안 하면: 빈 placeholder 파일 생성 후 사용자에게 알림

(b) 사용자가 직접 박을 줄의 형식만 안내:

```
ANTHROPIC_API_KEY=sk-ant-api03-여기에-너의-키
```

이 안내는 Claude Code가 작업 끝낸 후 보고 메시지에 포함만 하고, 직접 파일 수정은 안 함.

### 3. `.env.local.example` 파일 생성

`.gitignore`의 `!.env.local.example` 룰에 따라 이 파일은 git에 포함됨. 미래의 협업자/배포 환경 셋업용 템플릿.

내용:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Anthropic API
# 키 발급: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=
```

기존 .env.local에 이미 있는 변수명을 그대로 반영해야 함. 위 Supabase 변수명은 추정이므로, 실제 .env.local의 변수명을 먼저 확인 후 일치시킬 것.

### 4. 환경변수 타입 정의

`src/types/env.d.ts` 파일 생성 (또는 기존 파일이 있으면 추가):

```typescript
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string
    ANTHROPIC_API_KEY: string
  }
}

export {}
```

기존 Supabase 변수명은 .env.local에 박혀있는 그대로 사용. 위 코드에 박힌 변수명은 추정이므로 실제 .env.local 확인 후 일치시킬 것.

### 5. Anthropic 클라이언트 유틸 함수 작성

`src/lib/anthropic/client.ts` 파일 생성:

```typescript
import Anthropic from "@anthropic-ai/sdk"

let anthropicClient: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (anthropicClient) {
    return anthropicClient
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요."
    )
  }

  anthropicClient = new Anthropic({ apiKey })
  return anthropicClient
}
```

설계 이유:
- 싱글톤 패턴: 같은 요청 처리 중에 클라이언트 인스턴스 재사용
- 환경변수 미설정 시 명확한 한국어 에러 메시지 (디버깅 용이)
- `process.env.ANTHROPIC_API_KEY`는 서버 사이드에서만 접근 가능 (NEXT_PUBLIC_ prefix 없음)

**중요한 보안 원칙**: 이 함수는 절대 클라이언트 컴포넌트에서 import 되면 안 됨. API Route 또는 Server Component에서만 사용. CLAUDE.md 정책 #12와 일치.

### 6. Connection test용 임시 API route

`src/app/api/test/anthropic/route.ts` 파일 생성:

```typescript
import { NextResponse } from "next/server"
import { getAnthropicClient } from "@/lib/anthropic/client"

export async function GET() {
  try {
    const client = getAnthropicClient()
    
    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: "한국어로 '연결 성공' 4글자만 답하세요.",
        },
      ],
    })

    const textContent = response.content.find((block) => block.type === "text")
    
    return NextResponse.json({
      success: true,
      model: response.model,
      response: textContent?.type === "text" ? textContent.text : null,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 에러",
      },
      { status: 500 }
    )
  }
}
```

설계 이유:
- 가장 저렴한 모델(`claude-3-5-haiku-20241022`) 사용 — 연결 검증만 목적이라 비용 최소화
- `max_tokens: 50` — 응답도 짧게 제한
- 응답 토큰 수까지 반환 — 실제로 API 호출이 일어났는지 확인 가능
- 에러는 한국어 메시지로 반환

**보안 주의**: 이 라우트는 **연결 검증 후 즉시 삭제**할 임시 라우트. 운영 환경에 남으면 누구나 호출 가능해서 너의 API 크레딧을 소모할 수 있음. 검증 끝나면 다음 작업 시작 시점에 삭제.

이번 작업에서는 인증 가드 안 박음 (test route는 곧 삭제될 거라). 만약 며칠 이상 남겨둘 가능성이 있으면 인증 미들웨어 적용 필요. 미들웨어 matcher가 `/api/*` 제외하는 상태(decision_log.md에 기록됨)이므로 자체 인증 책임. 

### 7. 검증

#### 7-1. 타입 체크

```bash
npm run typecheck
```

통과 확인.

#### 7-2. .env.local에 키 박기 (사용자 작업)

이 시점에 Claude Code가 사용자에게 다음을 안내:

1. .env.local 파일을 직접 편집기로 연다
2. 다음 줄을 추가한다:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-너의-실제-키
   ```
3. 저장
4. dev 서버를 재시작 (Ctrl+C 후 다시 npm run dev) — 환경변수는 서버 시작 시에 로드되므로 반드시 재시작 필요

사용자가 키 박기 + dev 재시작 완료를 보고할 때까지 다음 단계 진행 X.

#### 7-3. Connection test 실행

dev 서버 재시작 후, 다음 URL에 GET 요청:

```
http://localhost:3000/api/test/anthropic
```

방법:
- 브라우저: 위 URL 직접 접속
- 또는 PowerShell:
  ```powershell
  Invoke-WebRequest -Uri http://localhost:3000/api/test/anthropic -Method GET | Select-Object -ExpandProperty Content
  ```

기대 응답:

```json
{
  "success": true,
  "model": "claude-3-5-haiku-20241022",
  "response": "연결 성공",
  "usage": {
    "input_tokens": 약 30,
    "output_tokens": 약 5
  }
}
```

`success: false`면 에러 메시지 그대로 보고. 가능한 원인:
- 키 미설정 → .env.local 확인 + dev 재시작 안 한 것
- 키 형식 오류 → 콘솔에서 키 다시 확인
- 콘솔 spending limit 도달 → 거의 불가능 (방금 $20 충전했고 이번 호출은 $0.001 미만)
- 네트워크 에러 → 잠시 후 재시도

### 8. 의사결정 로그 업데이트

`.claude/memory/decision_log.md`에 다음 항목 추가:

```markdown
## 2026-05-02: Anthropic SDK 셋업

### 결정
- @anthropic-ai/sdk 도입 (공식 SDK, fetch 직접 호출 안 함)
- API 클라이언트는 싱글톤 패턴, src/lib/anthropic/client.ts에 위치
- 환경변수 ANTHROPIC_API_KEY는 서버 사이드 전용 (NEXT_PUBLIC_ prefix X, 정책 #12 준수)
- .env.local.example 신규 생성 (협업/배포용 템플릿)
- src/types/env.d.ts에서 환경변수 타입 정의
- Connection test용 /api/test/anthropic GET route는 검증 후 다음 작업 시작 시점에 삭제 예정 (임시)
- 콘솔 spending limit 월 $20 설정됨 (rate limiter 코드 도입 전 안전장치)

### 이유
- SDK 사용이 fetch보다 타입 안전성 + 에러 핸들링 + 향후 streaming 등 기능 확장 유리
- 싱글톤은 매 요청마다 클라이언트 새로 만드는 비용 회피
- 임시 test route는 인프라 검증을 빠르게 하기 위함, 본 기능 구현 시 정식 route로 대체

### 다음 단계
- DB 스키마 (personas, messages 테이블 + RLS)
- 페르소나 추출 API Route + rate limiter (정책 #9)
- 페르소나 추출 프롬프트
- 페르소나 만들기 화면 UI
```

## 제약사항

- **API 키를 코드/git에 박지 않음**. .env.local에만 존재. .env.local.example에는 빈 값으로만.
- **Claude Code가 직접 .env.local에 키 값을 박지 않음**. 사용자가 직접 박음.
- **클라이언트 컴포넌트에서 anthropic/client.ts import 금지**. 서버 사이드(API Route, Server Component) 전용.
- **NEXT_PUBLIC_ prefix를 ANTHROPIC_API_KEY에 붙이지 않음**. 붙이면 클라이언트 번들에 키가 노출됨 (정책 #12 위반).
- **Server Actions 미사용**. API Route 방식 유지 (정책 #12).
- **단계별 보고 후 사용자 확인**. 각 단계(설치 → 파일 생성 → 클라이언트 → test route → 검증) 끝날 때마다 결과 보고.
- **git push 절대 금지**. 커밋까지만.

## 완료 조건

- [ ] `package.json` dependencies에 `@anthropic-ai/sdk` 추가됨
- [ ] `.env.local.example` 파일 생성됨 (실제 키 값 없이 변수명만)
- [ ] `src/types/env.d.ts` 환경변수 타입 정의 존재
- [ ] `src/lib/anthropic/client.ts` 싱글톤 클라이언트 함수 존재
- [ ] `src/app/api/test/anthropic/route.ts` connection test 라우트 존재
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과
- [ ] (사용자가) .env.local에 키 박은 후 dev 재시작
- [ ] `/api/test/anthropic` 호출 시 `success: true` + 한국어 응답 정상 반환
- [ ] usage.input_tokens / output_tokens 값이 실제 정수로 반환됨 (실제 API 호출이 일어난 증거)
- [ ] `.claude/memory/decision_log.md` 업데이트됨
- [ ] 커밋 완료 (push 안 함)

## 커밋 메시지 형식

```
feat(anthropic): SDK 셋업 및 환경변수 구성

- @anthropic-ai/sdk 설치
- .env.local.example 신규 생성 (협업용 템플릿)
- src/types/env.d.ts 환경변수 타입 정의
- src/lib/anthropic/client.ts 싱글톤 클라이언트 유틸
- src/app/api/test/anthropic/route.ts 연결 검증용 임시 라우트
- 콘솔 spending limit 월 $20 설정 (코드 차원 rate limiter 도입 전 안전장치)
- decision_log.md 업데이트
```

## 보고 단계

각 단계 끝날 때마다 보고하고 컨펌 받은 후 다음 단계 진행:

**1단계**: SDK 설치 후 → package.json 변경 부분 + npm install 출력 보고
**2단계**: 파일 생성 후 → .env.local 존재 여부, 기존 변수명 확인 결과, .env.local.example 내용, env.d.ts 내용 보고
**3단계**: 클라이언트 + test route 작성 후 → 두 파일 전체 내용 보고
**4단계**: typecheck + lint 결과 보고 → 통과하면 사용자에게 .env.local에 키 박으라고 안내
**5단계**: (사용자가 키 박았다고 보고하면) 사용자가 직접 /api/test/anthropic 호출 → 응답 결과 보고
**6단계**: 검증 통과 시 decision_log 업데이트 + 커밋

각 단계 사이에 사용자 컨펌 필수.
