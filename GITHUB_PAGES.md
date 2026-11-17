# GitHub Pages 시연 배포

이 프로젝트는 두 실행 방식을 지원합니다.

- **GitHub Pages 공개 시연**: 가상 데이터, 브라우저 저장, 관리/조회 역할 체험. 로그인 없이 누구나 이용할 수 있습니다.
- **로컬 Node 서버**: 실제 로그인, 관리자 권한 부여, 서버 파일 저장. GitHub Pages에서는 실행되지 않습니다.

## GitHub 최초 설정

1. 저장소 `https://github.com/lsh-big/finalproject`의 **Settings → Pages**를 엽니다.
2. **Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
3. 변경된 소스를 `main` 브랜치에 push합니다.
4. **Actions → Validate and deploy Pages demo**에서 테스트와 배포 결과를 확인합니다.
5. 배포 성공 후 `https://lsh-big.github.io/finalproject/`에 접속합니다.

현재 문서의 주소는 저장소 연결을 기준으로 한 예상 주소입니다. 로컬 코드 변경만으로 원격 게시가 완료되지는 않습니다. Actions가 성공한 뒤 실제 게시 여부를 확인하세요.

워크플로는 PR에서 테스트만 수행하고, `main` push 또는 수동 실행 시 테스트를 통과한 시연 빌드를 배포합니다. Pages 설정을 변경할 권한과 Actions 실행 권한이 필요합니다. 공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 로컬에서 Pages와 동일하게 확인

Node.js 22 이상에서 다음 명령을 실행합니다. 외부 패키지 설치는 필요하지 않습니다.

```powershell
npm.cmd run preview:pages
```

`http://127.0.0.1:3020/finalproject/`에서 확인합니다. `npm.cmd run build:pages`는 미리보기 서버 없이 `dist/pages/`를 생성합니다.

## 공개 시연의 동작

- 첫 접속 시 가상 예시 데이터가 표시됩니다. 계정과 비밀번호를 입력하지 않습니다.
- 관리 체험에서는 등록·수정·삭제·현장 기록·부품 입출고·계약 갱신·청구·수금을 체험할 수 있습니다.
- 조회 체험에서는 화면의 편집 기능을 제한합니다. 이것은 역할 체험이며 실제 보안 기능이 아닙니다.
- 변경 내용과 사진은 해당 브라우저의 localStorage에만 저장됩니다. 다른 기기나 다른 방문자에게 전송·공유되지 않습니다.
- **시연 초기화**를 누르면 해당 프로젝트의 브라우저 변경 내용과 역할을 지우고 예시 데이터로 돌아갑니다.
- 실제 고객·건물·직원 정보, 계정 비밀번호 등은 입력하지 마세요.
- 관제는 가상 피드입니다. ERP/HRTS/MAX/고객센터 자동 연동은 없습니다.
- 사진 등으로 브라우저 저장 한도를 넘기면 오류를 표시하고 마지막 정상 저장 데이터를 유지합니다.

## 배포 파일 분리

`public/runtime-config.js`의 기본값은 서버 모드입니다. `scripts/build-pages.mjs`가 허용된 공개 자산만 `dist/pages/`로 복사하고 **생성된 출력 안에서만** 시연 모드로 변경합니다.

GitHub Actions는 `public/`이나 저장소 전체 대신 **`dist/pages/`만 업로드**합니다. `.private/`, 실제 계정/비밀번호 해시, 사용자 관리 데이터, 서버 코드, 로그, 브라우저 검증 자료는 배포 산출물에 들어가지 않습니다. 코드에서 제공하는 가상 예시 데이터와 검증 규칙은 시연용으로 공개됩니다.

`public/`을 그대로 Pages에 게시하거나 저장소 루트를 배포하지 마세요. Pages의 Source는 반드시 GitHub Actions를 사용하세요.

## 검증

```powershell
npm.cmd test
```

서버 인증과 기존 관리 기능, 시연 저장·역할 전환·초기화, 재고/수금 검증, 공개 자산의 상대 경로와 배포 파일 제외 항목을 확인합니다.

선택적 실제 브라우저 검증: Pages 미리보기 서버(3020)와 격리한 Edge CDP(9224)를 실행한 뒤 `node tests/pages-browser-check.mjs`를 실행합니다. 실제 백엔드 요청이 발생하지 않는지도 검사합니다.
