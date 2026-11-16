# GitHub Pages 배포 안내

현재 저장소 연결: `https://github.com/lsh-big/finalproject.git`

배포 성공 후 예상 주소: **https://lsh-big.github.io/finalproject/**

주소는 현재 연결된 저장소 기준 예시이며, 실제 게시 완료 여부는 GitHub Actions와 Settings → Pages에서 확인합니다. 계정·저장소 이름이나 사용자 지정 도메인이 바뀌면 주소도 달라집니다.

## 최초 한 번 설정하기

1. GitHub에서 `lsh-big/finalproject` 저장소를 엽니다.
2. **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
3. 이 프로젝트의 변경 파일을 `main` 브랜치에 커밋하고 업로드(push)합니다. `.github/workflows/pages.yml`과 `public/` 폴더를 모두 포함해야 합니다. GitHub Desktop을 사용하는 경우 변경 파일을 확인한 뒤 Commit, Push origin 순으로 진행합니다.
4. 저장소의 **Actions**에서 **Validate and deploy GitHub Pages** 실행 결과를 확인합니다.
5. `validate`와 `deploy`가 모두 성공하면 배포 결과에 표시된 사이트 주소를 엽니다.

이미 파일을 올린 뒤 Pages 설정을 변경했다면 Actions → Validate and deploy GitHub Pages → Run workflow에서 `main`을 선택해 다시 실행할 수 있습니다.

Source를 ‘Deploy from a branch / root’로 설정하는 방식과는 다릅니다. 현재 저장소의 최상위에는 실행용 `index.html`이 없으며, 준비한 워크플로가 **public 폴더의 내용만** 웹사이트로 배포합니다.

## 이후 수정하기

`main` 브랜치에 변경 내용을 push하면 테스트 후 자동 배포됩니다. Pull request는 테스트만 실행하며 게시하지 않습니다. 로컬 작업만으로는 공개 사이트가 갱신되지 않습니다.

## 서버 없이 동작하는 기능

- 가상 데이터 생성, 전체 현황 및 품질 분석
- 검색, 제품 이력, AS 집계, 점검 우선순위
- API 없는 기술지원 시연, 보고서 및 해외 문의 초안
- JSON 가져오기와 CSV·TXT 내려받기

이 기능들은 방문자의 브라우저에서 처리합니다. `server.mjs`는 로컬 미리보기 도구이며 GitHub Pages에서는 실행하지 않습니다. 외부 패키지 설치나 별도 빌드도 필요 없습니다.

가져온 자료, 질문, 편집 내용은 서버에 저장되지 않고 다른 방문자와 공유되지 않습니다. 새로고침하면 초기화됩니다. 실제 API 연결·로그인·공용 DB는 향후 별도 서버 구성이 필요합니다. API 키를 `public/`에 넣지 않습니다.

## 경로와 새로고침

파일은 `./app.js`처럼 상대 경로로 불러오므로 `/finalproject/` 같은 프로젝트 주소와 사용자 지정 도메인 양쪽에서 사용할 수 있습니다. 각 화면은 `#home`, `#trace`, `#ai` 등의 주소를 사용하므로 해당 화면을 직접 열거나 새로고침할 수 있습니다.

## 로컬 검증

```powershell
npm.cmd test
npm.cmd start
```

GitHub Pages의 저장소 하위 경로와 같은 조건으로 확인하려면 별도 터미널에서 다음을 실행합니다.

```powershell
$env:PORT = '3001'
$env:BASE_PATH = '/finalproject'
node server.mjs
```

접속: http://localhost:3001/finalproject/

같은 터미널에서 기본 실행으로 돌아갈 때는 `Remove-Item Env:BASE_PATH, Env:PORT`로 환경변수를 지웁니다.

## 문제 해결

| 증상 | 확인할 내용 |
| --- | --- |
| configure-pages 단계 실패 | Settings → Pages에서 Source가 GitHub Actions인지, 저장소에서 Pages 사용이 가능한지 확인 |
| deploy 단계 권한 오류 | 저장소 Actions 정책과 github-pages 배포 환경의 브랜치 허용·승인 규칙 확인 |
| 사이트 404 | validate/deploy가 성공했는지와 Pages가 표시한 실제 주소 확인 |
| 수정 전 화면이 표시됨 | 최신 커밋의 배포 성공 여부 확인 후 Ctrl+F5 |
| 업로드한 자료가 사라짐 | 브라우저 메모리 처리이므로 새로고침 시 초기화되는 시연판의 정상 동작 |

GitHub 공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
