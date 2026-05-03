# 작업 docs A-1: 페르소나 추출 본 구현 1단계

> 페르소나 추출 라우트(`src/app/api/personas/extract/route.ts`)의 stub을 실제 구현으로 교체.
> Few-shot 1개(원본 학부모 사례 → 가명 "민준" 학부모)로 첫 검증 사이클을 짧게 가져감.
> Few-shot 추가(2~5번)는 docs A-2에서 수동 테스트 결과 검증 후 진행.

---

## 0. 작업 목표

- 페르소나 추출 라우트가 실제 Anthropic API를 호출해 비식별화된 대화 + 페르소나 JSON을 반환하도록 구현
- 시스템 프롬프트, Few-shot 1개, 출력 스키마, Zod 검증, 라우트 본 구현을 한 단위로 끼워넣음
- 1주차 4개 화면 중 "페르소나 만들기" 화면이 호출하는 백엔드의 본 동작 첫 버전

---

## 1. 반영할 결정 매핑

| 결정 | 반영 위치 |
|---|---|
| 결정 8 (모델 = Sonnet 4.6) | `src/lib/persona/extract.ts` 호출 시 `claude-sonnet-4-6` |
| 결정 9 (traits 구조 `{value, evidence}`) | 출력 JSON 스키마, Zod 스키마 |
| 결정 10 (1주차 = 텍스트 붙여넣기) | 라우트 input 검증, 시스템 프롬프트 0단계(형식 추론) |
| 결정 11 (메타데이터 best-effort, 형식별 차등) | 시스템 프롬프트 메타데이터 추출 섹션 |
| 결정 12 (JSON-only, Tool use X) | 시스템 프롬프트 출력 형식 강제, JSON 파싱 |
| 결정 13 (Few-shot 5개 → 1주차 1개부터) | `src/lib/persona/few-shots.ts` 1개만 우선 |
| 결정 14 (화자 혼합 → 단일 페르소나 + speaker_mixed flag) | 출력 스키마 `speaker_mixed` 필드 |
| 결정 15 (relationship_type nullable) | 출력 스키마 `relationship_type` nullable |

---

## 2. 수정/생성할 파일 목록

### 신규 생성 (3개)

- `src/lib/persona/system-prompt.ts` — 시스템 프롬프트 본문 export
- `src/lib/persona/few-shots.ts` — Few-shot 배열 export (1주차에는 1개)
- `src/lib/persona/schema.ts` — 출력 JSON 스키마 + Zod 검증
- `src/lib/persona/extract.ts` — Anthropic API 호출 + 응답 파싱 함수

(파일 4개. "신규 생성 (3개)" 표기는 위에 오타. 4개로 정정해서 진행할 것.)

### 수정 (1개)

- `src/app/api/personas/extract/route.ts` — stub 응답 제거, 위 `extract.ts` 호출 + 응답 형식 통일

---

## 3. 디렉토리 구조 의도

```
src/
  lib/
    persona/             ← 이번 작업으로 신규 생성
      system-prompt.ts
      few-shots.ts
      schema.ts
      extract.ts
    anthropic.ts         ← 기존, 그대로 활용
    ratelimit.ts         ← 기존, 라우트에서 그대로 활용
    supabase/            ← 기존
  app/
    api/
      personas/
        extract/
          route.ts       ← 수정 대상
```

`src/lib/persona/`로 페르소나 추출 관련 도메인 로직을 모음. 향후 메시지 다듬기는 `src/lib/message/`로 별도 분리 예정 (이번 docs 범위 외).

---

## 4. 출력 JSON 스키마 정의

### 4.1 최종 응답 형태 (라우트 → 클라이언트)

```json
{
  "anonymized_conversation": "마스킹 적용된 비식별화 대화 텍스트",
  "metadata": {
    "school_name": "string | null",
    "grade": "number | null",
    "class_number": "number | null",
    "import_format": "hitalk" | "kakaotalk" | "freeform"
  },
  "persona": {
    "relationship_type": "parent" | "colleague" | "external" | null,
    "student_label": "string | null",
    "speaker_mixed": true | false,
    "speaker_classification_note": "string | null",
    "traits": {
      "formality": { "value": "low" | "medium" | "high", "evidence": "..." },
      "empathy": { "value": "low" | "medium" | "high", "evidence": "..." },
      "assertiveness": { "value": "low" | "medium" | "high", "evidence": "..." },
      "length_preference": { "value": "short" | "medium" | "long", "evidence": "..." },
      "tone_signals": { "value": "string", "evidence": "..." },
      "writing_quirks": { "value": "string", "evidence": "..." }
    }
  }
}
```

### 4.2 traits 6개 항목 정의

| key | value 후보 | 의미 | evidence 예시 |
|---|---|---|---|
| `formality` | low / medium / high | 격식 수준 | "ㅇㅇ", "선생님 안녕하세요" 같은 인사 형태 |
| `empathy` | low / medium / high | 공감/감정 표현 빈도 | "마음이 너무 아파요", "걱정되네요" |
| `assertiveness` | low / medium / high | 단정/요구 강도 | "꼭 부탁드려요" vs "혹시 가능하시면" |
| `length_preference` | short / medium / long | 메시지 평균 길이 경향 | 한 메시지 평균 글자 수 또는 줄 수 |
| `tone_signals` | string (자유 서술) | 이모티콘, 어미 패턴 등 톤 신호 | "이모티콘 다수", "ㅠㅠ 빈번" |
| `writing_quirks` | string (자유 서술) | 띄어쓰기 오류, 오탈자 패턴 | "띄어쓰기 자주 흐트러짐" |

**evidence 규칙**: 비식별화된 대화에서 1~2 문장 인용 또는 패턴 요약. evidence가 비식별화 대화 안에 없는 정보를 만들어내면 안 됨 (LLM hallucination 방지).

### 4.3 결정 14 — speaker_mixed 의미

- `speaker_mixed: false` → 임포트 대화에 한 명의 발신자(학부모) 메시지만 있음. 페르소나는 그 한 명에 대한 것.
- `speaker_mixed: true` → 임포트 대화에 학생 메시지가 섞여있거나, 헤더와 실제 발신자가 일치하지 않는 경우. 페르소나는 가장 비중 큰 발신자 기준.
- `speaker_classification_note` → speaker_mixed=true일 때 어떤 메시지가 누구 메시지인지 LLM 판단 노트. UI에서 사용자에게 노출 가능.

### 4.4 결정 15 — relationship_type nullable

- 하이톡 형식: 헤더에서 "학부모"/"학생" 구분 가능 → 'parent' 또는 null
- 카카오톡 형식: 헤더 없음 → null 가능
- 자유 형식: 사용자가 임포트 후 UI에서 직접 선택. 라우트는 null 반환 가능

DB 저장 시점에는 사용자가 UI에서 'parent' 등으로 확정. 라우트 응답 단계에서는 null 허용.

---

## 5. Zod 스키마 (`src/lib/persona/schema.ts`)

```typescript
import { z } from "zod";

const TraitLevelSchema = z.object({
  value: z.enum(["low", "medium", "high"]),
  evidence: z.string().min(1).max(500),
});

const TraitFreeformSchema = z.object({
  value: z.string().min(1).max(200),
  evidence: z.string().min(1).max(500),
});

const TraitsSchema = z.object({
  formality: TraitLevelSchema,
  empathy: TraitLevelSchema,
  assertiveness: TraitLevelSchema,
  length_preference: z.object({
    value: z.enum(["short", "medium", "long"]),
    evidence: z.string().min(1).max(500),
  }),
  tone_signals: TraitFreeformSchema,
  writing_quirks: TraitFreeformSchema,
});

const MetadataSchema = z.object({
  school_name: z.string().nullable(),
  grade: z.number().int().min(1).max(6).nullable(),
  class_number: z.number().int().min(1).max(20).nullable(),
  import_format: z.enum(["hitalk", "kakaotalk", "freeform"]),
});

const PersonaSchema = z.object({
  relationship_type: z.enum(["parent", "colleague", "external"]).nullable(),
  student_label: z.string().nullable(),
  speaker_mixed: z.boolean(),
  speaker_classification_note: z.string().nullable(),
  traits: TraitsSchema,
});

export const ExtractResponseSchema = z.object({
  anonymized_conversation: z.string().min(1),
  metadata: MetadataSchema,
  persona: PersonaSchema,
});

export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;
```

**검증 실패 시 처리**: Anthropic 응답이 위 스키마를 어기면 라우트는 502 (또는 500) + 에러 메시지 반환. 클라이언트에서 재시도 가능. 1주차에는 자동 재시도 X.

---

## 6. 시스템 프롬프트 본문 (`src/lib/persona/system-prompt.ts`)

```typescript
export const SYSTEM_PROMPT = `당신은 한국 초등학교 교사가 학부모 메신저 대화를 임포트했을 때, 그 대화에서 학부모의 의사소통 페르소나를 추출하고 동시에 개인정보를 비식별화하는 어시스턴트입니다.

## 작업 단계

### 0단계: 임포트 형식 추론
받은 텍스트가 어떤 메신저 형식인지 추론합니다:
- **hitalk**: 헤더 메타데이터(학교/학년/반/이름), 학부모/학생 라벨이 명시적으로 존재
- **kakaotalk**: \`[이름/지역] [오전/오후 H:MM]\` 형태의 발신자 라벨, 헤더 메타데이터 없음
- **freeform**: 위 두 형식 어디에도 해당하지 않음. 자유 형식 (예: 사내 교원 메신저, 메모 형태)

추론 결과는 \`metadata.import_format\`에 기록합니다.

### 1단계: 화자 분류
각 메시지의 발신자를 다음 세 카테고리로 분류합니다:
- 학부모 메시지
- 학생 메시지 (있는 경우)
- 교사 메시지 (있는 경우, 이번 페르소나 추출 대상 아님)

대화에 학부모 외 발신자(학생 등) 메시지가 섞여 있으면 \`persona.speaker_mixed = true\`로 표기하고, \`speaker_classification_note\`에 어떤 메시지가 누구 메시지로 분류됐는지 간단히 적습니다. 학생 메시지만 있고 학부모 메시지가 없으면 그대로 처리하되 \`relationship_type\`은 결정 안 하고 null로 둡니다.

자유 형식의 경우 발신자 라벨이 불분명할 수 있습니다. 가능한 단서(어미, 호칭, 내용 맥락)로 추론하되 확신 없으면 \`speaker_mixed = true\`로 표기.

### 2단계: 비식별화 (마스킹)
다음 항목을 마스킹합니다 (원본 대화는 즉시 폐기, 마스킹된 버전만 \`anonymized_conversation\`에 기록):

**가림 (마스킹 대상)**:
- 학생 본명 → \`[학생]\`
- 학부모 자칭 (예: "OO엄마") → \`[학생] 어머님\`
- 다른 학생 본명 → \`[다른 학생]\`
- 병원명 → \`[병원명]\`
- 병원 위치/호실 → \`[병원호실]\`
- 병원 면회 시간 → \`[면회시간]\`
- 첨부 파일명 → \`[첨부 사진]\` 또는 \`[첨부 파일]\`
- 전화번호 → \`[연락처]\`
- 주소 → \`[주소]\`
- 구체적 질병 코드 번호 → 마스킹 (단, "질병코드"라는 용어 자체는 보존)

**보존 (절대 마스킹 X)**:
- 날짜, 시간대 (학부모 활동 패턴 신호)
- 일반 의료 용어 ("코 수술", "통원치료", "퇴원", "입원")
- 행정 용어 ("진료확인서", "진단서", "병과처리", "학교안전공제회")
- 감정 표현 (톤 신호 핵심)
- 화법 특성 (띄어쓰기 오류, 어미 패턴, 이모티콘) — 정제하지 마십시오
- 공식 사이트 URL

**메시지 경계 유지 규칙**: 발신자 라벨이 다음에 등장할 때까지 한 메시지로 묶습니다. 시각적 줄바꿈이나 페이지 footer가 메시지 중간에 끼어들어도 분리하지 않습니다.

### 3단계: 메타데이터 추출 (best-effort, 형식별 차등)
- **hitalk**: 헤더에서 \`school_name\`, \`grade\`, \`class_number\` 추출
- **kakaotalk**: 헤더 없음 → 모두 null
- **freeform**: 본문에서 단서 발견 시에만 추출. 없으면 null

추출 실패는 에러가 아니라 null로 표기.

### 4단계: 페르소나 traits 추출
\`traits\` 6개 항목을 추출합니다:
- \`formality\`: low / medium / high
- \`empathy\`: low / medium / high
- \`assertiveness\`: low / medium / high
- \`length_preference\`: short / medium / long
- \`tone_signals\`: 자유 서술 (이모티콘 빈도, 어미 패턴 등)
- \`writing_quirks\`: 자유 서술 (띄어쓰기 오류, 오탈자 패턴 등)

각 항목마다 \`evidence\`로 비식별화된 대화에서 1~2 문장 인용 또는 패턴 요약을 함께 제공합니다. **evidence는 반드시 anonymized_conversation 안에 실제로 존재하는 내용이어야 합니다.** 만들어내지 마십시오.

## Few-shot 예시의 \`(가명)\` 표기 처리 (중요)

이 시스템 프롬프트와 함께 제공되는 Few-shot 학습 예시(messages 배열의 user/assistant 턴)에는 식별자 뒤에 \`(가명)\` 표기가 붙어 있을 수 있습니다 (예: \`김민준(가명)\`, \`하늘초등학교(가명)\`, \`한빛병원(가명)\`).

이는 **학습 데이터 구분용 메타 표기**입니다. 실제 사용자 임포트 본문에는 등장하지 않습니다.

처리 규칙:
1. **마스킹 대상은 식별자 단어 자체**입니다. 예를 들어 input에 \`김민준(가명)\`이 등장하면 \`[학생]\`으로 마스킹하되, \`(가명)\` 표기는 매핑 처리에서 제외합니다 (즉 \`[학생](가명)\`이 아니라 \`[학생]\`).
2. **output 어디에도 \`(가명)\` 표기를 포함하지 마십시오.** anonymized_conversation, metadata, persona 모든 필드에서 \`(가명)\` 표기 금지.
3. **metadata.school_name 등에 학교명/병원명을 추출할 때**: 식별자 단어만 추출하고 \`(가명)\` 표기는 떼냅니다. 예: input의 \`하늘초등학교(가명)\` → \`metadata.school_name\`은 \`"하늘초등학교"\` (가명 표기 제거).
4. **실제 사용자 임포트 본문에는 \`(가명)\` 표기가 등장하지 않으므로** 위 규칙은 Few-shot 예시 처리에만 영향을 주고 실제 사용자 데이터 처리에는 영향이 없습니다.

## 출력 형식 (절대 규칙)

응답은 **반드시 단일 JSON 객체**로만 합니다. 다음 규칙을 엄격히 지킵니다:

1. JSON 외 텍스트, 설명, 마크다운 코드블록 금지
2. JSON 시작은 \`{\`, 끝은 \`}\`
3. 다음 최상위 키 3개만 허용: \`anonymized_conversation\`, \`metadata\`, \`persona\`
4. 각 키 누락 금지. 값을 알 수 없으면 null 또는 빈 문자열 대신 명시된 enum/타입 따름
5. 추출이 불가능한 경우에도 스키마 형태는 유지하고, 알 수 없는 필드는 null로 채움

## 출력 스키마 요약

\`\`\`json
{
  "anonymized_conversation": "<마스킹 적용된 대화 텍스트>",
  "metadata": {
    "school_name": "<string | null>",
    "grade": "<number | null>",
    "class_number": "<number | null>",
    "import_format": "<hitalk | kakaotalk | freeform>"
  },
  "persona": {
    "relationship_type": "<parent | colleague | external | null>",
    "student_label": "<string | null>",
    "speaker_mixed": "<boolean>",
    "speaker_classification_note": "<string | null>",
    "traits": {
      "formality": { "value": "<low|medium|high>", "evidence": "<string>" },
      "empathy": { "value": "<low|medium|high>", "evidence": "<string>" },
      "assertiveness": { "value": "<low|medium|high>", "evidence": "<string>" },
      "length_preference": { "value": "<short|medium|long>", "evidence": "<string>" },
      "tone_signals": { "value": "<string>", "evidence": "<string>" },
      "writing_quirks": { "value": "<string>", "evidence": "<string>" }
    }
  }
}
\`\`\`
`;
```

---

## 7. Few-shot 본문 (`src/lib/persona/few-shots.ts`)

### 7.0 PII 처리 정책 (이 docs에서 확정)

**원칙**: Few-shot input의 식별자(학생 본명·학부모 자칭·학교명·병원명)에 `(가명)` 표기를 명시적으로 박음. 실제 학부모 사례의 톤·격식·길이·띄어쓰기·행정 용어·위기 시나리오 디테일은 그대로 보존.

**가명 매핑 표 (Few-shot 1)**:

| 항목 | 원본 | 가명 (input 표기 형태) |
|---|---|---|
| 학생 이름 | (실제 학생 본명) | 김민준(가명) |
| 학부모 자칭 | (실제 학부모 자칭) | 민준엄마(가명) |
| 학교명 | (실제 학교명) | 하늘초등학교(가명) |
| 병원명 | (실제 병원명) | 한빛병원(가명) |

**`(가명)` 표기를 명시하는 이유**:

1. **사람 독자 오해 차단**: docs/코드/디버그 로그를 보는 사람이 "이게 진짜 학생/학교/병원 데이터구나" 오해할 위험 0. 한 눈에 가명임이 드러남.
2. **자연스러운 한국 이름이라 실존 동명 기관과 겹칠 위험**: "하늘초등학교", "한빛병원" 등은 검색 결과 실제 동명 기관이 다수 존재. `(가명)` 명시로 "우리 데이터는 가상이며 실제 기관과 무관"임을 분명히 함.
3. **PII 정책 일관성**: 실제 학부모 사례를 그대로 박는 것이 아니라 "식별자만 가명화한 학습 데이터"임을 git history에서도 명확히 추적 가능.

**LLM 헷갈림 방지** — 시스템 프롬프트(6절)에 다음 규칙 명시:
- Few-shot input의 `(가명)` 표기는 학습 데이터 마커이며 실제 사용자 임포트에는 등장하지 않음
- 마스킹 대상은 `(가명)` 표기가 아니라 그 앞의 식별자 단어 자체 (`김민준`, `하늘초등학교` 등)
- output에 `(가명)` 표기를 포함하지 말 것

**적용 범위**:
- Few-shot input (코드 안 5개 학습 예시)에만 박힘
- 실제 사용자가 임포트하는 본문 / output / DB 저장 / 화면 표시 어디에도 등장 X
- Few-shot이 운영에서도 유지되므로 결과적으로 영구 정책

**docs A-2에서 추가될 Few-shot 4개도 동일 정책 적용**. 가명 매핑은 각 Few-shot마다 docs A-2에서 명시.

### 7.1 Few-shot 1: 민준 학부모 (위기·정서·medium 격식)

**Input (사용자 임포트 텍스트, 식별자에 `(가명)` 명시 박은 버전)**:

```
[하이톡 헤더]
하늘초등학교(가명) / 4학년 3반 / 김민준(가명)

[학부모] 민준엄마(가명)
선생님 안녕하세요. 김민준(가명)이가 어제 학교 끝나고 횡단보도 건너다가 차에 부딪혀서 지금 한빛병원(가명) 5층 511호에 입원해 있어요.. 다리를 좀 다쳐서 수술을 해야할것같다고 하시네요.
면회는 오후 2시부터 6시까지 가능하다고 합니다.
김민준(가명)이가 많이 놀라서 지금 잠도 잘 못자고 그래요. 학교는 일주일 정도 쉬어야 할것같은데 어떻게 처리해야하나요?

[학부모] 민준엄마(가명)
아 그리고 진료확인서랑 진단서는 퇴원할때 받을수 있다고 하니까 그때 보내드릴게요.
혹시 학교안전공제회 처리하려면 또 따로 필요한 서류 있을까요? 처음이라 잘 몰라서요...
```

**Output (LLM이 반환해야 할 정확한 JSON)**:

```json
{
  "anonymized_conversation": "[학부모] [학생] 어머님\n선생님 안녕하세요. [학생]이가 어제 학교 끝나고 횡단보도 건너다가 차에 부딪혀서 지금 [병원명] [병원호실]에 입원해 있어요.. 다리를 좀 다쳐서 수술을 해야할것같다고 하시네요.\n면회는 [면회시간]에 가능하다고 합니다.\n[학생]이가 많이 놀라서 지금 잠도 잘 못자고 그래요. 학교는 일주일 정도 쉬어야 할것같은데 어떻게 처리해야하나요?\n\n[학부모] [학생] 어머님\n아 그리고 진료확인서랑 진단서는 퇴원할때 받을수 있다고 하니까 그때 보내드릴게요.\n혹시 학교안전공제회 처리하려면 또 따로 필요한 서류 있을까요? 처음이라 잘 몰라서요...",
  "metadata": {
    "school_name": "하늘초등학교",
    "grade": 4,
    "class_number": 3,
    "import_format": "hitalk"
  },
  "persona": {
    "relationship_type": "parent",
    "student_label": "[학생]",
    "speaker_mixed": false,
    "speaker_classification_note": null,
    "traits": {
      "formality": {
        "value": "medium",
        "evidence": "선생님 안녕하세요. 와 같은 인사는 격식 있으나, '~하시네요', '몰라서요...' 같은 종결어미는 가벼운 톤. 격식과 친근함 중간."
      },
      "empathy": {
        "value": "high",
        "evidence": "[학생]이가 많이 놀라서 지금 잠도 잘 못자고 그래요. 같이 자녀의 정서 상태를 자세히 공유. 감정 노출 빈도 높음."
      },
      "assertiveness": {
        "value": "low",
        "evidence": "어떻게 처리해야하나요?, 또 따로 필요한 서류 있을까요? 처럼 요청을 질문 형태로 부드럽게 표현. 단정 X."
      },
      "length_preference": {
        "value": "medium",
        "evidence": "한 메시지당 3~4문장, 한 호흡으로 여러 정보를 묶어 전달. 짧지도 길지도 않음."
      },
      "tone_signals": {
        "value": "이모티콘 없음. '..' (마침표 두 개) 사용으로 망설임/걱정 신호. 종결어미 '~네요', '~할것같은데'로 부드러운 톤.",
        "evidence": "지금 [병원명] [병원호실]에 입원해 있어요.. 에서 마침표 두 개로 감정 흔들림 표현."
      },
      "writing_quirks": {
        "value": "띄어쓰기 자주 흐트러짐 ('해야할것같다고', '쉬어야 할것같은데'). 어미 결합부에서 띄어쓰기 누락 빈번.",
        "evidence": "다리를 좀 다쳐서 수술을 해야할것같다고, 학교는 일주일 정도 쉬어야 할것같은데 에서 동일 패턴 반복."
      }
    }
  }
}
```

### 7.2 Few-shot 배열 export 형태

```typescript
/**
 * Few-shot 데이터 (페르소나 추출용).
 *
 * ===== PII 정책 =====
 * Few-shot input의 모든 식별자(학생 본명·학부모 자칭·학교명·병원명)에
 * `(가명)` 표기를 명시적으로 박습니다. 실제 학생/학교/병원과 무관합니다.
 *
 * 가명 매핑 (Few-shot 1):
 *   학생 이름:    (실제 학생 본명)  → 김민준(가명)
 *   학부모 자칭:  (실제 학부모 자칭) → 민준엄마(가명)
 *   학교명:       (실제 학교명)    → 하늘초등학교(가명)
 *   병원명:       (실제 병원명)    → 한빛병원(가명)
 *
 * ===== `(가명)` 표기 박는 이유 =====
 *   1. 사람 독자(개발자/검토자) 오해 차단. 한 눈에 가명임이 드러남.
 *   2. 자연스러운 한국 이름·학교명·병원명은 실존 동명 기관과 겹칠 위험.
 *      예: "하늘초등학교", "한빛병원"은 한국에 실제 동명 의료기관/학교 다수 존재.
 *      `(가명)` 명시로 "우리 데이터는 가상이며 실제 기관과 무관"임을 분명히 함.
 *   3. PII 정책 일관성. git history에서도 식별자 가명화 흔적이 명확히 추적됨.
 *
 * ===== LLM 헷갈림 방지 =====
 * 시스템 프롬프트(src/lib/persona/system-prompt.ts)에 다음 규칙 명시:
 *   - Few-shot input의 `(가명)` 표기는 학습 데이터 마커.
 *     실제 사용자 임포트에는 등장하지 않음.
 *   - 마스킹 대상은 `(가명)` 표기가 아니라 그 앞의 식별자 단어 자체.
 *     ("김민준" → [학생], "하늘초등학교" → [학교명] 또는 metadata로 추출 등)
 *   - output에 `(가명)` 표기 포함 금지.
 *
 * ===== 적용 범위 =====
 * `(가명)` 표기는 Few-shot input(이 배열의 input 필드)에만 박힘.
 * 실제 사용자 동작(임포트/output/DB/화면) 어디에도 등장하지 않음.
 * Few-shot은 운영에서도 유지되므로 결과적으로 영구 정책.
 */

export interface FewShot {
  id: string;
  description: string;
  input: string;
  output: string; // JSON string, parse 시점에 검증
}

export const FEW_SHOTS: FewShot[] = [
  {
    id: "minjun_parent_crisis_medium",
    description: "민준 학부모 — 식별자 모두 (가명) 표기. 위기 상황 (자녀 입원), 격식 medium, 공감 high, 길이 medium, 띄어쓰기 흐트러짐, 이모티콘 없음",
    input: `[하이톡 헤더]
하늘초등학교(가명) / 4학년 3반 / 김민준(가명)

[학부모] 민준엄마(가명)
선생님 안녕하세요. ...`,  // 위 7.1 Input 전체
    output: `{ ... }`,  // 위 7.1 Output 전체 JSON 문자열 — output에는 (가명) 표기 없음, 마스킹된 형태와 metadata만 포함
  },
];
```

**구현 시점에는 input/output 본문 전체를 문자열 리터럴로 박을 것.** 위 코드 스니펫은 구조만 보여주는 발췌.

---

## 8. extract.ts (Anthropic API 호출 함수)

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { SYSTEM_PROMPT } from "./system-prompt";
import { FEW_SHOTS } from "./few-shots";
import { ExtractResponseSchema, type ExtractResponse } from "./schema";

const MODEL = "claude-sonnet-4-6";  // 결정 8
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.3;  // 페르소나 추출은 낮은 temperature 권장

export class ExtractError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly stage?: "api" | "parse" | "validate"
  ) {
    super(message);
    this.name = "ExtractError";
  }
}

export async function extractPersona(conversationText: string): Promise<ExtractResponse> {
  // 1. messages 배열 구성 (Few-shot 포함)
  const messages: Anthropic.MessageParam[] = [];

  for (const fewShot of FEW_SHOTS) {
    messages.push({ role: "user", content: fewShot.input });
    messages.push({ role: "assistant", content: fewShot.output });
  }

  messages.push({ role: "user", content: conversationText });

  // 2. API 호출
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages,
    });
  } catch (err) {
    throw new ExtractError("Anthropic API 호출 실패", err, "api");
  }

  // 3. 텍스트 블록 추출
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ExtractError("응답에 텍스트 블록이 없음", undefined, "parse");
  }
  const rawText = textBlock.text.trim();

  // 4. JSON 파싱
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new ExtractError(
      `JSON 파싱 실패. 응답 본문: ${rawText.slice(0, 500)}`,
      err,
      "parse"
    );
  }

  // 5. Zod 검증
  const validation = ExtractResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new ExtractError(
      `스키마 검증 실패: ${validation.error.message}`,
      validation.error,
      "validate"
    );
  }

  return validation.data;
}
```

**짚어둘 점**:
- `temperature: 0.3` — 페르소나 추출은 일관성 우선. 0.0은 너무 결정적이라 evidence 표현이 단조로워질 수 있음. 0.3이 균형점. 추후 테스트하며 조정.
- Few-shot이 messages 배열로 들어가는 것은 표준 패턴. 시스템 프롬프트에는 작업 정의만, Few-shot은 user/assistant 턴으로 배치.
- `MAX_TOKENS = 4096` — 응답 JSON 크기 + 비식별화 대화 보존 고려. 일반 대화는 1500~2500 토큰. 초과 시 응답 truncate 위험은 낮음.

---

## 9. 라우트 수정 (`src/app/api/personas/extract/route.ts`)

기존 stub 응답 부분만 교체. 인증 가드, rate limiter, 입력 검증은 그대로 유지 (작업 B 결과).

### 9.1 수정 전후 비교 (의사 코드)

**수정 전 (stub)**:
```typescript
// ... 인증, rate limit, 입력 검증 통과 ...
return NextResponse.json({
  ok: true,
  message: "stub: 추출 로직 미구현",
});
```

**수정 후**:
```typescript
import { extractPersona, ExtractError } from "@/lib/persona/extract";

// ... 인증, rate limit, 입력 검증 통과 ...
try {
  const result = await extractPersona(body.conversation);
  return NextResponse.json({ ok: true, data: result });
} catch (err) {
  if (err instanceof ExtractError) {
    const status = err.stage === "api" ? 502 : 500;
    return NextResponse.json(
      { ok: false, error: { stage: err.stage, message: err.message } },
      { status }
    );
  }
  return NextResponse.json(
    { ok: false, error: { message: "알 수 없는 오류" } },
    { status: 500 }
  );
}
```

### 9.2 입력 검증 보강 (이번 docs 범위 내 최소한)

기존 작업 B에서 input 검증 stub이 있을 텐데, conversation 필드에 다음 추가:

- `body.conversation` 타입 string
- `body.conversation.trim().length >= 10` (최소 10자, 공백 제외)
- `body.conversation.length <= 50000` (최대 5만자, 토큰 비용 가드)

검증 실패 시 400 + 한국어 에러 메시지.

**참고**: 입력 검증 강화의 본격 작업은 docs B 범위. 여기서는 토큰 폭주 방지 목적의 최소 가드만.

### 9.3 응답 형식 통일

성공: `{ ok: true, data: <ExtractResponse> }`
실패: `{ ok: false, error: { stage?, message } }` + 적절한 status code

(클라이언트 통합은 1주차 후반 "페르소나 만들기" 화면 작업에서 별도)

---

## 10. 사용자 수동 테스트 절차

### 10.1 환경 준비

```powershell
cd C:\Users\jj689\projects\dadmda
npm run dev
```

`http://localhost:3000` 정상 기동 확인.

### 10.2 테스트 도구

Thunder Client (VS Code 확장) 또는 curl. PowerShell 클립보드 사고 회피를 위해 Thunder Client 권장 (핸드오프 12절).

### 10.3 인증 쿠키 확보

브라우저에서 OTP 로그인 → DevTools → Application → Cookies에서 Supabase 인증 쿠키 복사. Thunder Client에 헤더로 등록.

### 10.4 테스트 호출

**엔드포인트**: `POST http://localhost:3000/api/personas/extract`

**헤더**:
- `Content-Type: application/json`
- 쿠키 (위 10.3에서 확보)

**Body (Hans 로컬의 원본 학부모 메시지 — 학생 본명 가명화 X, 원본 그대로)**:

> Hans가 갖고 있는 원본 학부모 메시지를 그대로 conversation 값으로 넘김. 가명화는 학습용(Few-shot) 처리이고, 실제 사용자 임포트는 원본 그대로 들어가서 LLM이 비식별화하는 게 본 동작.

```json
{
  "conversation": "<Hans 로컬의 원본 학부모 메시지 전문, 줄바꿈 \\n으로 escape>"
}
```

### 10.5 결과 검증 체크리스트

- [ ] HTTP 200 응답
- [ ] `data.metadata.import_format === "hitalk"`
- [ ] `data.metadata.school_name`, `grade`, `class_number` 모두 추출됨 (헤더 있는 경우)
- [ ] `data.anonymized_conversation`에 학생 본명 등장 X (모두 `[학생]`으로 마스킹)
- [ ] `data.anonymized_conversation`에 병원명 등장 X (`[병원명]`으로 마스킹)
- [ ] `data.anonymized_conversation`에 호실 번호 등장 X (`[병원호실]`으로 마스킹)
- [ ] `data.anonymized_conversation`에 면회시간 구체적 시각 등장 X (`[면회시간]`으로 마스킹)
- [ ] `data.anonymized_conversation`에 띄어쓰기 오류 보존됨 (예: "해야할것같다고" 그대로)
- [ ] `data.persona.relationship_type === "parent"`
- [ ] `data.persona.speaker_mixed === false`
- [ ] `data.persona.traits.formality.value` ∈ {"medium"} (의도된 격식 수준 일치)
- [ ] `data.persona.traits.empathy.value` ∈ {"high"} (위기 상황 정서 표현 다수)
- [ ] `data.persona.traits.length_preference.value` ∈ {"medium"}
- [ ] 모든 traits에 `evidence` 필드 존재, evidence 내용이 anonymized_conversation 안에 실제 존재

### 10.6 결과 보고 후 docs A-2 진입

위 체크리스트 통과 시 docs A-2(Few-shot 4개 추가) 작성 진입.
일부 실패 시:
- 시스템 프롬프트 보강 (예: 마스킹 누락 항목 명시)
- Few-shot 본문 조정
- temperature 조정
중 어느 쪽 처리할지 claude.ai에서 분석 후 docs A-1 후속 패치.

---

## 11. 커밋 단위

### 옵션 A (단일 커밋, 추천)
모든 신규 파일 + 라우트 수정 한 커밋.

**커밋 메시지**:
```
feat(persona): 페르소나 추출 본 구현 1단계 (Few-shot 1개)

- src/lib/persona/system-prompt.ts: 시스템 프롬프트 본문 (4단계 작업 정의)
- src/lib/persona/few-shots.ts: Few-shot 1개 (민준 학부모, 가명화)
- src/lib/persona/schema.ts: 출력 JSON Zod 스키마 (결정 9, 14, 15 반영)
- src/lib/persona/extract.ts: Anthropic API 호출 + 파싱 + 검증
- src/app/api/personas/extract/route.ts: stub → 실제 호출 교체

결정 8~15 반영. Few-shot 4개 추가는 docs A-2에서 수동 테스트 후.
```

### 옵션 B (분할, 비추천)
schema → system-prompt → few-shots → extract → route 5개 커밋.
변경 범위가 강하게 결합돼있어 분할 의미 적음. 단일 커밋 채택.

---

## 12. 사용자 컨펌 게이트

Claude Code 진행 시 다음 시점에서 보고 후 사용자 컨펌:

1. **계획 보고** — 이 docs 읽고 4개 신규 파일 + 1개 수정 파일 목록과 변경 의도 보고
2. **schema.ts 작성 후** — Zod 스키마 본문 보고
3. **system-prompt.ts 작성 후** — 시스템 프롬프트 본문 보고 (긴 텍스트라 검토 시간 필요)
4. **few-shots.ts 작성 후** — Few-shot input/output 본문 보고
5. **extract.ts 작성 후** — 함수 본문 보고
6. **route.ts 수정 후** — diff 보고
7. **빌드 + 타입 체크** — `npm run build` 또는 `npm run type-check` 통과 확인
8. **staged 보고** — 커밋 전 git status + diff 요약
9. **커밋 실행** — 사용자 명시적 컨펌 후

각 단계에서 코드만 작성/수정. **수동 테스트(10절)는 사용자가 직접 실행**.

---

## 13. 이 docs 범위 외 (docs A-2 이후)

- Few-shot 4개 추가 (케이스 2 = 일상·격식 high·길이 long·이모티콘 학부모 → 가명 / 케이스 3 = 학생 라벨에 학부모 메시지 혼합 → 가명 학생-학부모 혼합 / 카카오톡 가상 / 자유 형식 가상). docs A-2에서 가명 매핑 명시.
- DB 저장 로직 (personas 테이블 INSERT) — docs B
- 입력 검증 강화 (다양한 엣지 케이스) — docs B
- 클라이언트 화면 ("페르소나 만들기") — 별도 docs
- relationship_type NOT NULL 제약 확인 후 마이그레이션 (필요 시) — 별도 docs
- 자동 재시도 로직 — 1주차 범위 외
- 캐싱 / prompt caching — 1주차 범위 외 (Anthropic prompt caching은 비용 절감용으로 추후)

### 후속 결정 16 후보 (docs A-1 Claude Code 실행 끝낸 후 별도 커밋)

decision_log에 결정 16 추가:
- 제목: Few-shot input 식별자 가명 표기 정책
- 내용 요약: Few-shot input의 모든 식별자에 \`(가명)\` 명시 박음. 시스템 프롬프트에서 LLM에게 메타 표기 처리 규칙 가르침. 실제 사용자 동작에는 영향 없음. docs A-2 이후 추가될 Few-shot도 동일 정책.
- 작업 단위: decision_log.md 텍스트 추가만, 코드 변경 0, 단일 커밋

---

**이 docs 끝. Claude Code에 전달해서 실행.**
