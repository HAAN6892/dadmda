-- personas 테이블 권한 부여 (authenticated 역할)
-- 20260504000001 마이그레이션에서 누락된 GRANT를 별도 파일로 보강
-- 원격 DB에는 이미 SQL Editor를 통해 적용된 상태(2026-05-06)
grant select, insert, update, delete on public.personas to authenticated;
