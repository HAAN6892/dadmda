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
