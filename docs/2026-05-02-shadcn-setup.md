# shadcn/ui 셋업

## 컨텍스트

- 다듬다 1주차, 4개 화면 본격 작업 진입 직전
- 현재 native input/button만 사용 중 (로그인 페이지)
- 다음 작업부터 카드·뱃지·슬라이더·토스트 등 컴포넌트 다양하게 필요
- 의사결정: claude.ai 세션에서 톤은 stone, 다크모드 라이트만, 브랜드 컬러는 보류, primary는 shadcn 기본값(블랙) 유지로 결정됨

## 작업 목표 (체크리스트)

- [ ] shadcn/ui 초기화 (`npx shadcn@latest init`)
- [ ] 9개 컴포넌트 설치
- [ ] ESLint에 `next/image` import 금지 룰 추가 (정책 #12 강제)
- [ ] 로그인 마이그레이션 placeholder 파일 생성 (까먹지 않게)
- [ ] 검증 (typecheck, dev 서버 실행)
- [ ] 의사결정 로그 업데이트
- [ ] 커밋 (사용자가 push)

## 구현 가이드

### 1. shadcn 초기화

```bash
npx shadcn@latest init
```

CLI 프롬프트 답변:
- Style: **new-york**
- Base color: **stone**
- CSS variables: **yes**
- Components 경로: `@/components/ui` (기본값)
- Utils 경로: `@/lib/utils` (기본값)
- 다크모드: **라이트만** (CLI에서 다크모드 묻지 않으면 그대로 진행)

검증:
- `components.json` 생성 확인
- `src/lib/utils.ts` 생성 확인 (cn 함수 포함)
- `src/app/globals.css`에 CSS variables 추가됨 확인
- `tailwind.config.ts`에 shadcn 토큰 매핑 추가됨 확인
- `package.json`에 `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` 추가됨 확인

### 2. 9개 컴포넌트 설치

순서대로 실행 (한 번에 묶어서도 가능):

```bash
npx shadcn@latest add button input label textarea card badge radio-group slider select sonner
```

설치 후 검증:
- `src/components/ui/` 디렉토리에 9개 파일 생성 확인
  - button.tsx, input.tsx, label.tsx, textarea.tsx, card.tsx, badge.tsx, radio-group.tsx, slider.tsx, select.tsx, sonner.tsx

### 3. ESLint `next/image` 금지 룰

`.eslintrc.json` (또는 `eslint.config.mjs`)에 다음 룰 추가:

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "next/image",
            "message": "보안 정책 #12에 따라 next/image 사용 금지. 일반 <img> 태그 또는 정적 자산 사용."
          }
        ]
      }
    ]
  }
}
```

기존 ESLint 설정 형식에 맞춰 통합. 기존에 `no-restricted-imports`가 있다면 paths 배열에 추가만.

검증:
- 임시 테스트 파일에 `import Image from 'next/image'` 작성 → `npm run lint` 실행 → 에러 발생 확인 → 테스트 파일 삭제

### 4. 로그인 마이그레이션 placeholder 파일 생성

`docs/2026-05-DD-login-shadcn-migration.md` 파일을 다음 내용으로 생성 (까먹지 않게 미리 박아둠):

```markdown
# 로그인 페이지 shadcn/ui 마이그레이션

## 컨텍스트
shadcn/ui 셋업(2026-05-02)은 완료. 로그인 페이지(src/app/(public)/login/page.tsx)의 native input/button을 shadcn 컴포넌트로 교체하는 작업.

## 우선순위
1주차 4개 화면 작업 중 적절한 타이밍에 진행. 셋업 직후 바로 안 해도 됨 (이미 작동 중이라 급하지 않음).

## 작업 목표 (체크리스트)
- [ ] native input → shadcn Input + Label
- [ ] native button → shadcn Button
- [ ] 에러 메시지 표시 → shadcn 토스트(Sonner) 또는 인라인 메시지 검토
- [ ] 기존 OTP 흐름 동작 검증

## 미정 항목
- 작성 시점에 결정
```

### 5. 검증

```bash
npm run typecheck
npm run dev
```

- 타입 에러 없음 확인
- 기존 페이지(/, /login 등) 깨짐 없이 렌더링 확인
- 로그인 페이지 정상 동작 확인 (OTP 발송 → 입력 → 진입)

### 6. 의사결정 로그 업데이트

`.claude/memory/decision_log.md`에 다음 항목 추가:

```markdown
## 2026-05-02: shadcn/ui 도입

### 결정
- shadcn/ui new-york 스타일 + stone 베이스 컬러 도입
- 다크모드 라이트만 (1주차 X)
- Primary 컬러: shadcn 기본값(블랙) 유지
- 브랜드 컬러 / 뱃지 컬러: 1주차 보류 (홈 화면 작업 시 결정)
- 9개 컴포넌트 1차 설치: button, input, label, textarea, card, badge, radio-group, slider, select, sonner
- ESLint `next/image` import 금지 룰 추가 (정책 #12 강제)
- 로그인 페이지 마이그레이션은 별도 작업으로 분리

### 이유
- 다음 작업부터 컴포넌트 다양하게 필요
- 코드 복사 방식이라 lock-in 없음
- 브랜드 컬러는 흔들림 패턴(스코프 확장) 회피 위해 보류
- 로그인 분리는 "한 PR에 한 가지 일" 원칙
```

## 제약사항

- **Server Actions 금지** (CLAUDE.md #12). shadcn `form.tsx` 미설치(react-hook-form은 추후 작업).
- **next/image 금지** (CLAUDE.md #12). 셋업 작업 중 어떤 컴포넌트도 next/image import 금지.
- **rewrites 금지** (CLAUDE.md #12). next.config 변경 없음.
- **다크모드 토큰 추가 금지**. globals.css의 `.dark` 블록은 shadcn CLI가 깔아주는 그대로 두되, `next-themes` 등 다크모드 활성화 라이브러리는 설치 X.
- **단계별 보고 후 사용자 확인**. 1번(초기화) → 2번(컴포넌트 설치) → 3번(ESLint) → 4번(placeholder) → 5번(검증) 각 단계 끝날 때마다 결과 보고.
- **git push 절대 금지**. 커밋까지만. push는 사용자가 직접.

## 완료 조건

- [ ] `components.json` 존재
- [ ] `src/components/ui/` 디렉토리에 9개 컴포넌트 파일 존재
- [ ] `src/lib/utils.ts` 존재 (cn 함수)
- [ ] `tailwind.config.ts`에 shadcn 토큰 매핑됨
- [ ] `src/app/globals.css`에 CSS variables 추가됨
- [ ] `package.json`에 lucide-react, class-variance-authority, clsx, tailwind-merge 추가됨
- [ ] ESLint `next/image` 금지 룰 적용 + 동작 검증 완료
- [ ] `docs/2026-05-DD-login-shadcn-migration.md` placeholder 파일 생성됨
- [ ] `npm run typecheck` 통과
- [ ] `npm run dev` 정상 작동, 기존 페이지 깨짐 없음
- [ ] 로그인 OTP 흐름 정상 작동 확인
- [ ] `.claude/memory/decision_log.md` 업데이트됨
- [ ] 커밋 완료 (push 안 함)

## 커밋 메시지 형식

shadcn 셋업과 ESLint 정책 강제는 논리적으로 한 단위. 커밋 1개로 묶는다.

```
chore(ui): shadcn/ui 셋업 및 next/image 금지 룰 추가

- shadcn/ui new-york + stone 베이스 초기화
- 9개 컴포넌트 설치 (button, input, label, textarea, card, badge, radio-group, slider, select, sonner)
- ESLint no-restricted-imports로 next/image 금지 (정책 #12 강제)
- 로그인 마이그레이션 placeholder 문서 생성
- 다크모드 라이트만, 브랜드 컬러 1주차 보류
```

placeholder 파일 생성과 decision_log 업데이트도 같은 커밋에 포함.
