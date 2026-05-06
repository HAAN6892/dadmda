-- 다듬다 personas 테이블 재생성
-- 동일 모델 페르소나 1개 = 1 row
-- AI 추출 결과를 저장하는 스키마로 변경
-- 기존 마이그레이션(20260502000001)은 stub 시점의 스키마였으므로 폐기

-- ==========================================
-- 0. 기존 테이블 드롭
-- ==========================================
-- Step 0에서 personas 테이블 row 수 = 0건 확인됨 (또는 데이터 폐기 결정됨)
-- CASCADE: 향후 추가될 다른 테이블의 FK 참조도 함께 정리
drop table if exists public.personas cascade;

-- 트리거 함수 set_updated_at()는 기존 마이그레이션에서 정의됨 (재사용)

-- ==========================================
-- 1. personas 테이블
-- ==========================================
create table public.personas (
  -- 식별자
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- 사용자 입력 영역 (1주차에는 클라이언트 화면에서 추후 입력)
  -- name: 페르소나 전체 이름 (UI 표시용). 예: "철수 어머님"
  -- AI 추출 시점에는 NULL, 클라이언트에서 사용자가 입력
  name text,

  -- AI 추출 결과 — 페르소나 핵심 필드 (정규화된 컬럼)
  -- student_label: 학생 식별자 라벨 (메시지 안에 사용). 예: "[학생]"
  -- relationship_type: 관계 유형. AI 추출 결과 (parent/colleague/external/null)
  -- speaker_mixed: 화자 구분 모호 여부 (결정 14)
  -- speaker_classification_note: 화자 분류 근거 (LLM 판단 노트)
  student_label text,
  relationship_type text check (relationship_type in ('parent', 'colleague', 'external')),
  speaker_mixed boolean not null,
  speaker_classification_note text,

  -- AI 추출 결과 — 페르소나 부가 정보 (jsonb)
  -- traits: 6개 trait + evidence (formality, empathy, assertiveness, length_preference, tone_signals, writing_quirks)
  -- metadata: school_name, grade, class_number, import_format
  -- 스키마는 추출 프롬프트 단계에서 결정 + Zod 검증
  traits jsonb not null,
  metadata jsonb not null,

  -- AI 추출 결과 — 비식별화된 대화
  -- 페르소나 재추출 시 이전 마스킹 재용. 1주차에는 단순 보존
  anonymized_conversation text not null,

  -- 사용자 입력 영역 — 페르소나 자연어 요약
  -- 1주차에는 AI가 만들지 않음 (NULL 유지). 추후 메시지 작성 화면에서 필요 시 별도 작업
  summary text,

  -- 메타
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Soft delete (기존 정책 유지)
  -- 실수 복구 가능성 위해. RLS에서 deleted_at IS NULL 자동 적용
  deleted_at timestamptz
);

-- ==========================================
-- 2. 인덱스
-- ==========================================
-- 사용자별 페르소나 조회. user_id + deleted_at 부분 인덱스 (기존 정책 유지)
create index idx_personas_user_id_active
  on public.personas(user_id)
  where deleted_at is null;

-- ==========================================
-- 3. updated_at 자동 갱신 트리거
-- ==========================================
-- set_updated_at() 함수는 기존 마이그레이션에서 정의됨 (재사용)
create trigger personas_set_updated_at
  before update on public.personas
  for each row
  execute function public.set_updated_at();

-- ==========================================
-- 4. RLS 활성화 + 정책
-- ==========================================
-- 본인 데이터만 접근 가능. service_role bypass 없음.
-- soft delete 행은 SELECT에서 제외 (RLS 단에서 처리)
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

-- DELETE: 본인 것만 (정책상 권장 안 되지만 emergency용으로 열어둠. soft delete는 UPDATE로)
create policy "Users can delete own personas"
  on public.personas
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================================
-- 5. 코멘트 (DB 자체 문서화)
-- ==========================================
comment on table public.personas is '동일 모델 페르소나. 초등교사가 동일 모델과의 메시지 톤/문체에서 추출한 인물상';
comment on column public.personas.name is '페르소나 표시 이름. 사용자 자유 입력. AI 추출 시 NULL, 클라이언트에서 사용자가 입력';
comment on column public.personas.student_label is 'AI 추출. 학생 식별 라벨. 마스킹된 대화에서 사용. 예: [학생]';
comment on column public.personas.relationship_type is 'AI 추출. 관계 유형. 1주차는 parent. 미래 colleague, external 확장';
comment on column public.personas.speaker_mixed is 'AI 추출. 화자 구분 모호 여부 (결정 14). true면 페르소나 정확도 낮을 가능성';
comment on column public.personas.speaker_classification_note is 'AI 추출. 화자 분류 근거. UI에서 사용자에게 노출 가능';
comment on column public.personas.traits is 'AI 추출. 6개 trait + evidence (jsonb). 스키마는 src/lib/persona/schema.ts에서 정의';
comment on column public.personas.metadata is 'AI 추출. school_name/grade/class_number/import_format (jsonb). best-effort';
comment on column public.personas.anonymized_conversation is 'AI 추출. 비식별화된 원본. 페르소나 재추출 시 마스킹 재용';
comment on column public.personas.summary is '사용자 입력. 페르소나 자연어 요약. 1주차에 AI 미생성, 향후 별도 작업';
comment on column public.personas.deleted_at is 'Soft delete 시각. NULL이면 활성. RLS에서 자동 필터';
