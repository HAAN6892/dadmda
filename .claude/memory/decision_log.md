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
