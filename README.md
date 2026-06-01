# 웹소설 (이펍 뷰어 스타일)

깃허브 페이지스에 그대로 올릴 수 있는 **정적 웹소설 사이트**입니다. 빌드 도구가 필요 없습니다.

- 블로그처럼 화 목록을 보여주는 메인 페이지
- 이펍 뷰어처럼 읽는 본문 페이지 (페이지 넘김 / 세로 스크롤 토글, 글자 크기·테마 설정)
- 강화된 복사 방지 (우클릭·드래그·복사·단축키·인쇄 차단)

---

## 폴더 구조

```
.
├── index.html              메인(블로그 목록)
├── reader.html             이펍 뷰어
├── .nojekyll               깃허브 페이지스가 폴더를 그대로 서빙하게 함
├── assets/
│   ├── css/style.css       목록 페이지 스타일
│   ├── css/reader.css      뷰어 스타일(테마/페이지)
│   └── js/
│       ├── main.js         목록 렌더링
│       ├── reader.js       뷰어 로직
│       └── protect.js      복사 방지
└── chapters/
    ├── chapters.json       제목/작가/화 목록(목차)
    ├── 001.html            1화 본문
    └── 002.html            2화 본문
```

---

## ✍️ 새 화 올리는 방법

1. `chapters/` 폴더에 `003.html` 처럼 새 HTML 파일을 만들고 **본문만** 작성합니다.
   `<head>`나 `<body>` 없이, 아래처럼 본문 태그만 넣으면 됩니다.

   ```html
   <h2>3화 제목</h2>
   <p>첫 문단…</p>
   <p>둘째 문단…</p>
   <hr>   <!-- 장면 전환 -->
   <p>…</p>
   ```

2. `chapters/chapters.json` 의 `chapters` 배열에 한 줄 추가합니다.

   ```json
   {
     "id": "003",
     "title": "3화. 새로운 화",
     "date": "2026-06-10",
     "summary": "목록에 보일 한 줄 소개(생략 가능)"
   }
   ```

   > `id` 는 파일 이름(`003.html`)과 똑같이 맞춰야 합니다.

3. 제목·작가·소개글은 `chapters.json` 맨 위의 `title` / `author` / `description` 을 수정하세요.

---

## 🖥️ 로컬에서 미리 보기

`fetch()` 를 쓰기 때문에 파일을 더블클릭(file://)하면 본문이 안 보입니다.
간단한 로컬 서버로 열어야 합니다. 프로젝트 폴더에서:

```powershell
# Python 이 있으면
python -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속.

---

## 🚀 깃허브 페이지스 배포

1. 깃허브에 새 저장소를 만들고 이 폴더 전체를 푸시합니다.

   ```powershell
   git init
   git add .
   git commit -m "웹소설 사이트"
   git branch -M main
   git remote add origin https://github.com/<사용자명>/<저장소명>.git
   git push -u origin main
   ```

2. 저장소 → **Settings → Pages** → Source 를 `Deploy from a branch`,
   Branch 를 `main` / `/(root)` 로 지정하고 저장.

3. 잠시 후 `https://<사용자명>.github.io/<저장소명>/` 에서 열립니다.

---

## 🔒 복사 방지에 대한 안내

웹 브라우저 특성상 **100% 차단은 불가능**합니다. 개발자도구·소스 보기·스크린샷·OCR 등은
원천적으로 막을 수 없습니다. 이 사이트의 복사 방지는 *일반 독자의 손쉬운 복사/재배포를
강하게 억제*하는 수준이며, 차단 항목은 다음과 같습니다.

- 마우스 우클릭(컨텍스트 메뉴)
- 텍스트 드래그 선택 / 길게 눌러 선택(iOS)
- 복사·잘라내기 (Ctrl/⌘ + C / X)
- 전체 선택·저장·소스 보기·인쇄 (Ctrl/⌘ + A / S / U / P)
- 개발자도구 단축키 (F12, Ctrl/⌘+Shift+I/J/C)
- 인쇄 시 본문 숨김

차단 동작을 바꾸려면 `assets/js/protect.js` 를 수정하세요.
