# 모닝머니북클럽(MMBC) 앱

휴대폰 홈 화면에 설치할 수 있는 웹앱(PWA)입니다. 비용 0원으로 운영하는 구성입니다.

- **화면**: 이 폴더의 파일 그대로 (빌드 과정 없음)
- **데이터 저장**: Supabase 무료 요금제 (회원, 모임, 보증금 기록, 과제, 투표)
- **사이트 주소**: Vercel 또는 GitHub Pages 무료 호스팅

`config.js`에 Supabase 정보가 비어 있으면 **체험용 모드**로 동작합니다(데이터는 그 기기에만 저장).

## 실제 운영으로 바꾸는 순서 (약 20분)

### 1. Supabase 만들기 (데이터 저장소)
1. https://supabase.com 에서 GitHub 또는 구글 계정으로 가입 → **New project** (지역: Northeast Asia (Seoul))
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용을 전부 붙여넣고 **Run**
3. **Authentication → Sign In / Providers → Email**에서 **Confirm email**을 끄기
   (닉네임으로만 가입하기 때문에 이메일 확인 단계가 없어야 합니다)
4. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사해 `config.js`에 붙여넣기
   (anon 키는 공개되어도 되는 키입니다. `service_role` 키는 절대 넣지 마세요)

### 2. 사이트 올리기
- GitHub 저장소에 이 폴더를 올린 뒤 https://vercel.com 에서 **Add New → Project → 저장소 선택 → Deploy**
  (Framework: Other, 빌드 명령 없음)

### 3. 클럽장 계정 지정
1. 사이트에서 TONY 닉네임으로 회원가입
2. Supabase SQL Editor에서 한 번 실행:
   `update public.profiles set role = 'admin' where nickname = 'TONY';`

### 4. 홈 링크 채우기
`config.js`의 `links`에 인스타그램, 스레드, 카카오톡 오픈채팅 주소를 넣으면 홈 버튼이 연결됩니다.

## 알아두면 좋은 점
- Supabase 무료 요금제는 **일주일 동안 아무도 접속하지 않으면 일시정지**됩니다. 대시보드에서 다시 켜면 됩니다. 회원이 꾸준히 쓰면 문제없습니다.
- 무료 한도(데이터 500MB, 월 활성 사용자 5만 명)는 회원 1000명에 충분합니다.
- 비밀번호를 잊은 회원은 클럽장이 Supabase 대시보드(Authentication → Users)에서 초기화해 줄 수 있습니다.
- 보증금 입금/환급/기부는 지금처럼 계좌이체로 하고, 앱은 기록과 확인만 합니다.

## 파일 구성
| 파일 | 내용 |
|---|---|
| `index.html`, `styles.css` | 화면 틀과 디자인 |
| `js/app.js` | 모든 화면과 동작 |
| `js/store-demo.js` | 체험용 저장소(기기 내부) |
| `js/store-supabase.js` | 실제 운영 저장소(Supabase) |
| `supabase/schema.sql` | 데이터베이스 표와 보안 규칙 |
| `config.js` | 운영 설정(Supabase 키, 링크, 금액 기준) |
| `manifest.webmanifest`, `sw.js`, `icons/` | 앱 설치(PWA)용 |
