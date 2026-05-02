# npm audit 후속 처리

## 컨텍스트
shadcn/ui 셋업(2026-05-02) 중 next-themes uninstall 시점에 npm이 5 vulnerabilities (1 moderate, 4 high) 보고. 셋업 작업 단위 유지를 위해 별도 작업으로 분리.

## 우선순위
shadcn 셋업 커밋 push 직후 또는 1주차 4개 화면 작업 중 적절한 타이밍.

## 작업 목표 (체크리스트)
- [ ] npm audit 실행해서 어떤 패키지에 어떤 취약점인지 확인
- [ ] high 취약점 4개 우선 분류 (직접 의존성인지 transitive인지)
- [ ] npm audit fix 시도 (breaking change 없는지 확인)
- [ ] breaking change 있으면 결정점: 업그레이드 vs 무시 (위험도 판단)
- [ ] decision_log.md에 처리 결과 기록

## 미정 항목
audit 실행 후 결정.
