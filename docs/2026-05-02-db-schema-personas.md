# DB 스키마: personas 테이블

## 컨텍스트

- 다듬다 1주차, Supabase CLI 셋업 완료 직후
- 페르소나 = 학부모 1명 = 1 row 모델 확정
- 1주차에는 personas 테이블 1개만. students 테이블은 미래 확장 시 분리 (현재는 student_label 텍스트 컬럼으로)
- 비식별화는 다음 작업(페르소나 추출 API Route)에서 처리. 이번 단계는 **테이블 모양만**

## 작업 목표 (체크리스트)

- [ ] `supabase/migrations/` 디렉토리에 첫 migration SQL 파일 생성
- [ ] personas 테이블 + 인덱스 + 트리거 + RLS 정책 SQL 작성
- [ ] `supabase db push` 실행 (사용자 비번 입력 가능성)
- [ ] 원격 DB 적용 검증 (Dashboard에서 테이블 존재 확인은 사용자가)
- [ ] migration list로 LOCAL/REMOTE 동기화 확인
- [ ] 의사결정 로그 업데이트
- [ ] 커밋 (사용자가 push)

## 사용자 vs Claude Code 작업 구분

**Claude Code 작업**:
- 1단계: SQL 파일 작성
- 3단계 이후: migration list 검증, decision_log 업데이트, 커밋

**사용자 작업**:
- 2단계: `supabase db push` 실행 (비번 입력 가능성)
- 4단계: Supabase Dashboard에서 테이블 생성 시각 확인

## 구현 가이드

### 1단계: Migration SQL 파일 생성 (Claude Code)

파일 경로:
```
supabase/migrations/20260502000001_create_personas.sql
```

파일명 명명 규칙:
- Supabase migration은 `YYYYMMDDHHMMSS_설명.sql` 형식
- 작성 시점 timestamp 사용 (대략적이어도 OK)
- 첫 migration이라 시간 부분은 `000001`로 단순화

파일 내용:

```sql
-- 다듬다 personas 테이블
-- 학부모 페르소나 1개 = 1 row
-- 1차 사용자: 초등교사. 자기가 만든 페르소나만 접근 가능 (RLS)

-- ==========================================
-- 1. updated_at 자동 갱신 함수
-- ==========================================
-- 여러 테이블에서 재사용할 공통 함수. 다른 테이블에서도 동일 트리거 사용 가능.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==========================================
-- 2. personas 테이블
-- ==========================================
create table public.personas (
  -- 식별자
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- 사용자 입력 라벨
  -- name: 페르소나 자체 이름 (UI 표시용). 예: "철수 어머니"
  -- student_label: 학생 식별용 라벨 (미래에 학생 그룹핑 시 활용). 예: "철수, 1번"
  -- relationship_type: 관계 타입. 1주차는 'parent' 고정. 미래 확장 위해 컬럼 유지
  name text not null,
  student_label text,
  relationship_type text not null default 'parent',
  
  -- AI 추출 결과 (사용자 수정 가능)
  -- summary: 페르소나 요약 (자연어 한 문단)
  -- traits: 구조화된 특징 (말투, 관심사, 우려사항 등). 스키마는 추출 프롬프트 단계에서 확정
  summary text,
  traits jsonb,
  
  -- 비식별화된 대화 누적
  -- 페르소나 재추출 시 이전 맥락 활용용
  -- 학기 누적되면 길어질 수 있으나 1주차 단순화 위해 단일 텍스트 컬럼
  anonymized_conversation text,
  
  -- 메타
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Soft delete
  -- 실수 복구 가능성 위해 영구 삭제 대신 deleted_at 채움
  -- 모든 조회 쿼리는 RLS에서 deleted_at IS NULL 자동 적용
  deleted_at timestamptz
);

-- ==========================================
-- 3. 인덱스
-- ==========================================
-- 사용자별 페르소나 조회가 가장 빈번한 쿼리. user_id + deleted_at 부분 인덱스
create index idx_personas_user_id_active 
  on public.personas(user_id) 
  where deleted_at is null;

-- ==========================================
-- 4. updated_at 자동 갱신 트리거
-- ==========================================
create trigger personas_set_updated_at
  before update on public.personas
  for each row
  execute function public.set_updated_at();

-- ==========================================
-- 5. RLS 활성화 + 정책
-- ==========================================
-- 자기가 만든 페르소나만 접근 가능. 공유 X.
-- soft delete된 행은 SELECT에서 제외 (RLS 단에서 처리)
alter table public.personas enable row level security;

-- SELECT: 본인 + 삭제 안 된 것만
create policy "Users can view own active personas"
  on public.personas
  for select
  to authenticated
  using (auth.uid() = user_id and deleted_at is null);

-- INSERT: 본인 user_id로만
create policy "Users can insert own personas"
  on public.personas
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE: 본인 것만 (soft delete 위한 deleted_at 변경도 UPDATE)
create policy "Users can update own personas"
  on public.personas
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: 본인 것만 (정책상 권장 안 하지만 emergency용으로 열어둠. soft delete는 UPDATE로)
create policy "Users can delete own personas"
  on public.personas
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================================
-- 6. 코멘트 (DB 자체 문서화)
-- ==========================================
comment on table public.personas is '학부모 페르소나. 초등교사가 학부모와의 메신저 대화에서 추출한 인물상';
comment on column public.personas.name is '페르소나 표시 이름. 사용자 자유 입력. 예: 철수 어머니';
comment on column public.personas.student_label is '학생 식별 라벨. 미래 학생 그룹핑 위한 텍스트 컬럼. 예: 철수, 1번';
comment on column public.personas.relationship_type is '관계 타입. 1주차 parent만 사용. 미래 colleague, external 등 확장';
comment on column public.personas.summary is 'AI 추출 페르소나 요약. 사용자 수정 가능';
comment on column public.personas.traits is 'AI 추출 구조화 특징. JSONB. 스키마는 추출 프롬프트 단계에서 확정';
comment on column public.personas.anonymized_conversation is '비식별화된 원본 대화 누적. 페르소나 재추출 시 맥락 활용';
comment on column public.personas.deleted_at is 'Soft delete 시각. NULL이면 활성. RLS에서 자동 필터';
```

작성 후 검증:
- 파일 경로 확인 (`supabase/migrations/20260502000001_create_personas.sql`)
- 파일 내용 전체 보고 (사용자 검토용)

### 2단계: db push 안내 (사용자 작업)

Claude Code는 명령어 실행하지 않고 안내만:

```
supabase db push
```

PowerShell에서 프로젝트 루트(C:\Users\jj689\projects\dadmda)에서 실행.

**비번 프롬프트가 뜰 가능성 높음**:
- "Enter your database password" 표시되면 사용자가 직접 비번 입력
- PowerShell이 입력 가림 (별표도 안 보임). 정상.

**예상 출력**:
```
Connecting to remote database...
Applying migration 20260502000001_create_personas.sql...
Finished supabase db push.
```

**실패 시나리오**:
- 비번 오류: Dashboard에서 reset 후 재시도
- SQL 문법 오류: 에러 메시지 그대로 보고
- 권한 오류: Dashboard에서 RLS/Auth 설정 확인 필요

사용자가 push 결과 보고할 때까지 다음 단계 진행 X.

### 3단계: migration list 검증 (Claude Code)

push 성공 보고 받으면:

```bash
supabase migration list
```

기대 결과:
- LOCAL 컬럼: `20260502000001` 1개
- REMOTE 컬럼: `20260502000001` 1개 (push 후 동기화됨)
- Time (UTC): push 시각

LOCAL/REMOTE 모두 1개씩 + 동일 ID면 동기화 정상.

### 4단계: 사용자 Dashboard 검증

Claude Code가 사용자에게 안내:

```
Supabase Dashboard에서 검증:
1. https://supabase.com/dashboard 접속
2. dadmda 프로젝트 선택
3. 좌측 Database → Tables 메뉴
4. public 스키마에 personas 테이블 보이는지 확인
5. personas 클릭하면 컬럼 9개 표시되는지 확인:
   id, user_id, name, student_label, relationship_type,
   summary, traits, anonymized_conversation,
   created_at, updated_at, deleted_at
6. 좌측 Database → Policies 메뉴에서 personas에 4개 RLS 정책 보이는지 확인
```

사용자가 검증 완료 보고할 때까지 다음 단계 진행 X.

### 5단계: decision_log 업데이트 + 커밋

`.claude/memory/decision_log.md`에 추가:

```markdown
## 2026-05-02: personas 테이블 마이그레이션

### 결정
- 1주차 테이블 1개만 생성: personas. students 테이블은 미래 확장 시 분리
- 학생 그룹핑은 student_label TEXT 컬럼으로 처리 (1주차 단순화)
- relationship_type 컬럼 포함 (1주차 'parent' 고정, 미래 colleague/external 확장 대비)
- traits 컬럼은 jsonb (구조 자유도 확보, 스키마는 추출 프롬프트 단계에서 확정)
- anonymized_conversation 단일 컬럼 누적 방식 (1주차 단순화. 길어지면 별도 테이블로 분리 검토)
- Soft delete (deleted_at). RLS에서 자동 필터로 삭제된 행 비공개
- RLS 정책 4개 (SELECT/INSERT/UPDATE/DELETE) 모두 auth.uid() = user_id 기준
- updated_at 자동 갱신 트리거 (set_updated_at 함수, 미래 다른 테이블도 재사용 가능)
- DB 코멘트로 컬럼별 의도 자체 문서화

### 진행 중 발견 사항
- (작업 중 발견 시 추가)

### 이유
- 1주차는 메인 흐름(임포트 → 페르소나 → 메시지 다듬기) 검증이 핵심. 테이블 분리는 검증 후
- student_label 컬럼은 텍스트로 두면 미래에 students 테이블 분리 시 마이그레이션 단순 (컬럼 → FK)
- jsonb는 페르소나 특징 구조가 사용자 데이터 보면서 진화할 수 있어서. 컬럼 분리는 구조 확정 후
- soft delete는 학부모 정보라는 민감 데이터 특성상 실수 복구 가능성 우선
- DB 코멘트는 미래의 너/협업자가 컬럼 의도 즉시 파악 가능

### 다음 단계
- 페르소나 추출 API Route + rate limiter (정책 #9 도입 시점)
- 페르소나 추출 프롬프트 작성 (비식별화 + 페르소나 추출 동시 처리)
- 페르소나 만들기 화면 UI
- /api/test/anthropic 임시 라우트 삭제
```

### 6단계: 커밋

git status 확인:
- A supabase/migrations/20260502000001_create_personas.sql
- M .claude/memory/decision_log.md
- A docs/2026-05-02-db-schema-personas.md

의도 외 파일 있으면 멈추고 보고.

커밋 메시지:

```
feat(db): personas 테이블 마이그레이션

- supabase/migrations/20260502000001_create_personas.sql 생성
- personas 테이블 + 인덱스 + RLS 4개 정책 + updated_at 트리거
- student_label 텍스트 컬럼 (미래 students 분리 시 마이그레이션 가능)
- relationship_type 컬럼 (1주차 'parent', 미래 확장 대비)
- traits jsonb (구조 자유도)
- anonymized_conversation 누적 컬럼 (비식별화된 원본)
- Soft delete (deleted_at) + RLS에서 자동 필터
- DB 코멘트로 컬럼별 의도 문서화
- decision_log.md 업데이트

검증된 사실:
- supabase db push 성공
- supabase migration list LOCAL/REMOTE 동기화 확인
- Dashboard에서 테이블 + 4개 RLS 정책 확인
```

git push 절대 금지. 커밋까지만.

## 제약사항

- **SQL 파일은 supabase/migrations/ 외 위치에 만들지 않음**. CLI가 그 폴더를 보고 동기화함
- **db push 명령은 사용자가 직접 실행**. Claude Code는 명령어 안내만. 비번 노출 방지
- **단계별 보고 + 사용자 컨펌**. 6단계 게이트
- **git push 절대 금지**

## 완료 조건

- [ ] supabase/migrations/20260502000001_create_personas.sql 존재 + 내용 정확
- [ ] supabase db push 성공 (사용자 보고)
- [ ] supabase migration list LOCAL/REMOTE 동일 ID로 동기화
- [ ] 사용자 Dashboard에서 personas 테이블 + 컬럼 11개 + RLS 정책 4개 확인
- [ ] decision_log.md 업데이트
- [ ] 커밋 완료 (push 안 함)

## 보고 단계

**1단계**: SQL 파일 작성 후 → 파일 경로 + 전체 내용 보고. 사용자 검토 후 컨펌.

**2단계**: 사용자가 db push 실행 → 결과(성공 메시지 또는 에러) 보고.

**3단계**: Claude Code가 supabase migration list 실행 → LOCAL/REMOTE 컬럼 결과 보고.

**4단계**: 사용자가 Dashboard 검증 → 테이블 / 컬럼 / 정책 확인 결과 보고.

**5단계**: Claude Code가 decision_log 업데이트 → 추가된 섹션 보고. 컨펌 후 커밋.

**6단계**: git status / commit / git log -1 --stat 결과 보고. 종료.

각 단계 사이 사용자 컨펌 필수.
