# Supabase CLI 셋업

## 컨텍스트

- 다듬다 1주차, Anthropic SDK 셋업(2026-05-02) 완료 직후
- Migration을 git으로 관리하기 위해 Supabase CLI 도입 (옵션 B 선택)
- 사용자 환경: Windows + PowerShell, Scoop/Supabase CLI 모두 미설치 상태
- 이번 작업은 **인프라 셋업** 단위. DB 스키마 작성은 다음 docs에서 별도 진행

## 작업 목표 (체크리스트)

- [ ] (사용자 작업) Scoop 설치
- [ ] (사용자 작업) Scoop으로 Supabase CLI 설치
- [ ] (사용자 작업) Supabase CLI 로그인
- [ ] `supabase init` 실행 (로컬 프로젝트 구조 생성)
- [ ] `supabase link` 실행 (원격 프로젝트 연결)
- [ ] .gitignore 검증 (Supabase 관련 민감 파일 차단)
- [ ] 연결 검증 (원격 DB 인식 확인, 빈 schema 확인)
- [ ] 의사결정 로그 업데이트
- [ ] 커밋 (사용자가 push)

## 사용자 vs Claude Code 작업 구분

이번 작업은 사용자 직접 작업과 Claude Code 작업이 섞여 있음:

**사용자가 직접 (PowerShell에서 실행)**:
- 1단계: Scoop 설치
- 2단계: Supabase CLI 설치
- 3단계: CLI 로그인 (브라우저 인증)

**Claude Code가 (코드/설정 관련)**:
- 4단계: `supabase init`
- 5단계: `supabase link` 안내 (사용자가 비번 입력)
- 6단계: .gitignore 검증/수정
- 7단계: decision_log 업데이트 + 커밋

각 단계 끝날 때마다 보고 + 컨펌.

## 구현 가이드

### 1단계: Scoop 설치 (사용자 작업)

PowerShell을 **관리자 권한 아닌 일반 권한**으로 열고 다음 두 명령어 실행:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

(이미 설정되어 있으면 변경 없음. "Y" 묻는 메시지 뜨면 Y 입력)

```powershell
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

설치 완료 후 검증:

```powershell
scoop --version
```

→ 버전 정보 나오면 OK

**막힐 수 있는 지점**:
- 회사 PC라 ExecutionPolicy 변경 막힐 수 있음 → 그때 Claude Code에 막힌 화면 보고
- Scoop 설치 도중 권한 에러 → PowerShell 재시작 후 재시도

### 2단계: Supabase CLI 설치 (사용자 작업)

Scoop 설치 후 PowerShell에서:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
```

(Scoop이 Supabase 공식 bucket을 알게 함)

```powershell
scoop install supabase
```

설치 완료 후 검증:

```powershell
supabase --version
```

→ 버전 정보 (예: `2.x.x`) 나오면 OK

### 3단계: Supabase CLI 로그인 (사용자 작업)

```powershell
supabase login
```

→ 브라우저가 자동으로 열리고 Supabase Dashboard 인증 화면 표시
→ "Authorize Supabase CLI" 또는 비슷한 버튼 클릭
→ PowerShell에 "Logged in" 메시지 뜨면 OK

**보안 주의**: 이 인증은 access token을 발급받아 로컬에 저장. token은 너 홈 디렉토리의 `~/.supabase/` 또는 비슷한 위치에 저장됨. git에 안 올라감 (CLI가 알아서 처리).

### 4단계: `supabase init` (Claude Code 작업)

프로젝트 루트(`C:\Users\jj689\projects\dadmda`)에서:

```bash
supabase init
```

이 명령은 다음 파일/폴더를 생성:
- `supabase/` 폴더
  - `config.toml` (로컬 Supabase 설정)
  - `seed.sql` (초기 데이터 스크립트, 옵션)
  - `.gitignore` (Supabase 관련 ignore 규칙)
- 기타 메타 파일

**옵션 프롬프트가 뜨면**:
- "Generate VS Code workspace settings?" → No
- "Generate IntelliJ IDEA workspace settings?" → No
- (기타 IDE 옵션) → 모두 No
- 1주차 단순화 위해 IDE 통합 비활성화

검증:
- `supabase/` 디렉토리 생성 확인
- `supabase/config.toml` 파일 존재 확인
- 파일 내용 보여주기

### 5단계: `supabase link` (사용자 + Claude Code 협업)

Claude Code가 다음 명령어 안내만 하고 사용자가 직접 실행:

```bash
supabase link --project-ref <PROJECT_ID>
```

`<PROJECT_ID>`는 사용자가 자기 Supabase Dashboard에서 확인한 Project ID로 대체.

**중요: Claude Code는 PROJECT_ID 자체를 코드/명령어에 박지 않음.** 사용자가 직접 명령어에 박아서 PowerShell에서 실행.

실행 시:
- "Enter your database password" 프롬프트 나옴
- 사용자가 직접 비번 입력 (PowerShell이 입력 가림)
- Enter

성공 메시지: "Finished supabase link"

**Claude Code는 link 명령어 자체를 실행하지 않음**. 안내 텍스트만 출력하고 사용자에게 직접 실행 요청.

### 6단계: .gitignore 검증 (Claude Code 작업)

`supabase init`이 자동으로 `supabase/.gitignore`를 만들어주지만, 프로젝트 루트의 `.gitignore`도 확인 필요.

확인 항목:
- `supabase/.branches` 또는 `supabase/.temp` 같은 임시 폴더가 ignore되는지
- `**/supabase/.env*` 같은 패턴이 있는지

기존 `.gitignore`에 다음 내용이 없으면 추가:

```
# Supabase
supabase/.branches
supabase/.temp
**/supabase/.env*
```

이미 있으면 그대로 두고 보고.

### 7단계: 연결 검증 (Claude Code 작업)

다음 명령어로 원격 DB와 동기화 확인:

```bash
supabase db remote commit --dry-run
```

또는 연결 상태만 확인:

```bash
supabase status
```

(현재 로컬 Supabase 인스턴스가 안 떠있을 수도 있음. 우리는 원격 직접 사용 모드라 status는 not running일 수 있음. 그게 정상.)

**더 확실한 검증**: 빈 migration 만들어서 원격 schema 가져오기

```bash
supabase db pull --schema public --dry-run
```

→ 원격 DB의 public schema가 비어있다는 정보 + 에러 없이 종료되면 연결 정상

### 8단계: 의사결정 로그 업데이트

`.claude/memory/decision_log.md`에 추가:

```markdown
## 2026-05-02: Supabase CLI 셋업

### 결정
- Migration 관리 방식: 옵션 B (Supabase CLI + git 관리)
- CLI 설치 방법: Scoop (Windows 패키지 매니저) → 미래 도구 확장 + 자동 업데이트
- supabase/ 폴더를 프로젝트 루트에 생성 (config.toml 등 설정 파일 포함)
- Project ID와 Database password는 .env.local 또는 PowerShell에서 직접 입력 (코드/git에 박지 않음)
- IDE 통합(VSCode, IntelliJ workspace settings) 비활성화 (1주차 단순화)

### 진행 중 발견 사항
- Scoop과 Supabase CLI 모두 신규 설치. 사용자가 직접 실행
- supabase init 후 IDE 통합 옵션은 모두 No 선택

### 이유
- Migration이 코드의 일부라는 원칙 (재현 가능성, 협업/배포 대비)
- Scoop이 npm 글로벌 설치보다 공식 권장 방법
- Database password 같은 민감 정보를 Claude Code 컨텍스트에 노출하지 않기 위해 사용자 직접 실행 단위 분리

### 다음 단계
- students + personas 테이블 + RLS migration 작성
- supabase db push로 원격 DB에 적용
- 페르소나 추출 / 메시지 다듬기 본 기능 작업
```

## 제약사항

- **Database password를 절대 코드/git/Claude Code 컨텍스트에 노출하지 않음**. 사용자가 PowerShell에 직접 입력.
- **Project ID도 docs 프롬프트에는 placeholder(`<PROJECT_ID>`)로만**. 사용자가 실행 시 직접 박음.
- **IDE 통합 비활성화**. 1주차 단순화 + 협업자별 설정 다를 수 있음.
- **단계별 보고 + 사용자 컨펌**. 8단계 게이트 명시.
- **사용자 직접 실행 단계는 Claude Code가 명령어만 안내**, 실제 실행은 사용자.
- **git push 절대 금지**. 커밋까지만.

## 완료 조건

- [ ] `scoop --version` 정상 작동
- [ ] `supabase --version` 정상 작동
- [ ] `supabase login` 완료 (사용자가 보고)
- [ ] `supabase/` 디렉토리 생성됨 + config.toml 존재
- [ ] `supabase link` 성공 (사용자가 비번 입력 완료 보고)
- [ ] `.gitignore`에 Supabase 관련 ignore 규칙 존재
- [ ] `supabase db pull --schema public --dry-run` 에러 없이 종료
- [ ] decision_log.md 업데이트됨
- [ ] 커밋 완료 (push 안 함)

## 커밋 메시지 형식

```
chore(supabase): CLI 셋업 및 원격 프로젝트 link

- Supabase CLI 설치 (Scoop 경유)
- supabase init으로 로컬 프로젝트 구조 생성
- 원격 다듬다 프로젝트와 link 완료
- .gitignore에 Supabase 임시 파일 차단 규칙 확인/추가
- IDE 통합 비활성화 (1주차 단순화)
- decision_log.md 업데이트
```

## 보고 단계

각 단계 끝날 때마다 보고하고 컨펌 받은 후 다음 단계 진행:

**1단계 (사용자)**: Scoop 설치 후 사용자가 보고. Claude Code는 보고 받고 다음 안내.

**2단계 (사용자)**: Supabase CLI 설치 후 사용자가 보고.

**3단계 (사용자)**: Login 완료 후 사용자가 보고.

**4단계 (Claude Code)**: `supabase init` 실행 후 → 생성된 파일 리스트 + config.toml 내용 보고. 컨펌 받기.

**5단계 (사용자)**: Claude Code가 link 명령어 안내. 사용자가 PROJECT_ID 박고 실행. 비번 입력. "Finished" 메시지 보고.

**6단계 (Claude Code)**: .gitignore 검증/수정 후 변경 부분 diff 보고. 컨펌 받기.

**7단계 (Claude Code)**: `supabase db pull --schema public --dry-run` 실행 결과 보고. 에러 없으면 컨펌 받기.

**8단계 (Claude Code)**: decision_log 업데이트 후 git status 보여주고, 의도 외 파일 0건 확인. 컨펌 받으면 커밋. 커밋 후 git log -1 --stat 보여주고 종료. push 안 함.

각 단계 사이 사용자 컨펌 필수.
