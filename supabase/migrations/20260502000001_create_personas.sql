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
