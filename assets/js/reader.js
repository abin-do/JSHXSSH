/* =========================================================================
 * reader.js — 이펍 스타일 뷰어
 *  - chapters.json 으로 화 순서를 파악하고 chapters/<id>.html 본문을 로드
 *  - 페이지 넘김(다단 컬럼) / 세로 스크롤 모드 토글
 *  - 글자 크기 · 테마 설정 (localStorage 저장)
 *  - 키보드(←/→/Space) · 클릭 영역 · 스와이프 지원
 * ========================================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var els = {
    body: document.body,
    content: $('content'),
    stage: $('stage'),
    chName: $('ch-name'),
    pageIndicator: $('page-indicator'),
    progress: $('progress'),
    prevCh: $('prev-ch'),
    nextCh: $('next-ch'),
    edgeLeft: $('edge-left'),
    edgeRight: $('edge-right'),
    loading: $('reader-loading'),
    settingsPanel: $('settings-panel'),
    btnSettings: $('btn-settings'),
    btnMode: $('btn-mode')
  };

  var state = {
    chapters: [],
    index: -1,        // 현재 화의 chapters 배열 인덱스
    page: 0,          // paginated 모드의 현재 페이지(0부터)
    totalPages: 1,
    pageStep: 0       // 한 페이지당 가로 이동량(px)
  };

  /* ---------------- 설정(localStorage) ---------------- */
  var PREF = {
    get mode() { return localStorage.getItem('reader.mode') || 'paginated'; },
    set mode(v) { localStorage.setItem('reader.mode', v); },
    get theme() { return localStorage.getItem('reader.theme') || 'light'; },
    set theme(v) { localStorage.setItem('reader.theme', v); },
    get fontScale() { return parseFloat(localStorage.getItem('reader.font') || '1'); },
    set fontScale(v) { localStorage.setItem('reader.font', String(v)); },
    get fontFace() { return localStorage.getItem('reader.fontface') || 'sans'; },
    set fontFace(v) { localStorage.setItem('reader.fontface', v); }
  };

  var BASE_FONT = 0.896; // rem — 기존 1.12에서 '가−' 두 번(×0.8) 줄인 크기를 기본으로


  function applyPrefs() {
    els.body.setAttribute('data-mode', PREF.mode);
    els.body.setAttribute('data-theme', PREF.theme);
    els.body.setAttribute('data-fontface', PREF.fontFace);
    document.documentElement.style.setProperty(
      '--reader-font-size', (BASE_FONT * PREF.fontScale).toFixed(3) + 'rem');
    syncSettingButtons();
  }

  function syncSettingButtons() {
    document.querySelectorAll('#seg-mode button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === PREF.mode);
    });
    document.querySelectorAll('#seg-theme button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.theme === PREF.theme);
    });
    document.querySelectorAll('#seg-fontface button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.fontface === PREF.fontFace);
    });
  }

  /* ---------------- URL 파라미터 ---------------- */
  function getParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  /* ---------------- 초기 로드 ---------------- */
  applyPrefs();

  // 웹폰트(본명조 등)가 늦게 로드되면 글자 폭이 바뀌므로 로드 완료 후 재계산
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { requestAnimationFrame(relayout); });
  }

  fetch('chapters/chapters.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('목차 로드 실패'); return r.json(); })
    .then(function (data) {
      state.chapters = data.chapters || [];
      var id = getParam('ch') || (state.chapters[0] && state.chapters[0].id);
      state.index = state.chapters.findIndex(function (c) { return String(c.id) === String(id); });
      if (state.index < 0) state.index = 0;
      return loadChapter(state.index);
    })
    .catch(function (err) {
      els.loading.textContent = '불러올 수 없습니다: ' + err.message;
    });

  /* ---------------- 화 로드 ---------------- */
  function loadChapter(idx) {
    var ch = state.chapters[idx];
    if (!ch) return Promise.resolve();
    els.loading.style.display = 'flex';

    return fetch('chapters/' + ch.id + '.html', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(ch.id + '.html 없음'); return r.text(); })
      .then(function (html) {
        var heading = ch.title || ('제 ' + ch.id + ' 화');
        // 화 머리말(제목 / 점선 / 내용) + 본문
        var head = '<header class="chapter-head"><h1>' +
          esc(heading) + '</h1><div class="rule"></div></header>';
        els.content.innerHTML = head + html;
        els.chName.textContent = heading;
        document.title = ch.title || '읽기';
        state.page = 0;
        // URL 갱신(뒤로가기 자연스럽게)
        history.replaceState(null, '', 'reader.html?ch=' + encodeURIComponent(ch.id));
        updateChapterNav();
        // 레이아웃 계산은 다음 프레임에
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            relayout();
            els.body.scrollTop = 0;
            window.scrollTo(0, 0);
            els.loading.style.display = 'none';
          });
        });
      })
      .catch(function (err) {
        els.content.innerHTML = '<p style="text-align:center;opacity:.6">' +
          err.message + '</p>';
        els.loading.style.display = 'none';
      });
  }

  function updateChapterNav() {
    els.prevCh.disabled = state.index <= 0;
    els.nextCh.disabled = state.index >= state.chapters.length - 1;
  }

  /* ---------------- 페이지 레이아웃(다단 컬럼) 계산 ---------------- */
  function relayout() {
    if (PREF.mode === 'scroll') {
      // 페이지 모드에서 넣었던 인라인 스타일을 모두 해제 → CSS 스크롤 규칙 복귀
      els.content.style.columnWidth = '';
      els.content.style.columnGap = '';
      els.content.style.transform = '';
      els.content.style.height = '';
      els.content.style.width = '';
      els.content.style.maxWidth = '';
      els.content.style.marginLeft = '';
      els.content.style.marginRight = '';
      updateProgress();
      return;
    }
    // 한 페이지 너비 = 무대의 "안쪽"(패딩 제외) 너비. 보이는 영역과 정확히 일치시켜야
    // 컬럼이 어긋나거나 글자가 잘리지 않는다.
    var cs = getComputedStyle(els.stage);
    var stageInner = els.stage.clientWidth
      - (parseFloat(cs.paddingLeft) || 0)
      - (parseFloat(cs.paddingRight) || 0);
    // 컬럼 갭은 reader.css 의 48px.
    var gap = 48;
    var colWidth = stageInner; // 한 페이지에 한 단 = 보이는 영역 전체
    els.content.style.columnWidth = colWidth + 'px';
    els.content.style.columnGap = gap + 'px';
    els.content.style.width = colWidth + 'px';
    els.content.style.maxWidth = 'none';   // CSS 42rem 클램프 해제(JS 폭이 페이지 폭)
    els.content.style.marginLeft = '0';
    els.content.style.marginRight = '0';

    // 페이지(컬럼) 높이를 줄 높이의 정수배로 스냅 → 마지막 줄이 반 잘리는 것 방지
    snapContentHeight();

    state.pageStep = colWidth + gap;
    // 전체 페이지 수
    var total = els.content.scrollWidth;
    state.totalPages = Math.max(1, Math.round(total / state.pageStep));
    if (state.page > state.totalPages - 1) state.page = state.totalPages - 1;
    if (state.page < 0) state.page = 0;
    renderPage();
  }

  // 본문 높이를 한 줄 높이의 정수배로 맞춘다(페이지 하단 줄 잘림 방지)
  function snapContentHeight() {
    els.content.style.height = '';            // 먼저 CSS 기본(100%)으로 되돌려 실제 가용 높이 측정
    var cs = getComputedStyle(els.content);
    var lh = parseFloat(cs.lineHeight);
    var padTop = parseFloat(cs.paddingTop) || 0;
    var padBottom = parseFloat(cs.paddingBottom) || 0;
    var fullH = els.content.clientHeight;     // 패딩 포함 내부 높이
    var textH = fullH - padTop - padBottom;   // 실제 글이 들어가는 높이
    if (lh > 0 && textH > lh) {
      var snapped = Math.floor(textH / lh) * lh;
      els.content.style.height = (snapped + padTop + padBottom) + 'px';
    }
  }

  function getReaderWidthRem() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--reader-width');
    return parseFloat(v) || 42;
  }
  function remToPx(rem) {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  function renderPage() {
    var x = -state.page * state.pageStep;
    els.content.style.transform = 'translateX(' + x + 'px)';
    updateProgress();
  }

  function updateProgress() {
    if (PREF.mode === 'paginated') {
      els.pageIndicator.textContent =
        (state.page + 1) + ' / ' + state.totalPages + ' 쪽';
      var pct = state.totalPages > 1
        ? (state.page / (state.totalPages - 1)) * 100 : 100;
      els.progress.style.width = pct + '%';
    } else {
      els.pageIndicator.textContent = (state.index + 1) + ' / ' + state.chapters.length + ' 화';
    }
  }

  /* ---------------- 페이지/화 이동 ---------------- */
  function nextPage() {
    if (PREF.mode !== 'paginated') return;
    if (state.page < state.totalPages - 1) {
      state.page++;
      renderPage();
    } else {
      goNextChapter();
    }
  }
  function prevPage() {
    if (PREF.mode !== 'paginated') return;
    if (state.page > 0) {
      state.page--;
      renderPage();
    } else {
      goPrevChapter(true);
    }
  }
  function goNextChapter() {
    if (state.index < state.chapters.length - 1) {
      state.index++;
      loadChapter(state.index);
    }
  }
  function goPrevChapter(toLastPage) {
    if (state.index > 0) {
      state.index--;
      loadChapter(state.index).then(function () {
        if (toLastPage && PREF.mode === 'paginated') {
          state.page = state.totalPages - 1;
          renderPage();
        }
      });
    }
  }

  /* ---------------- 이벤트 ---------------- */
  // 클릭 영역(좌/우)
  els.edgeRight.addEventListener('click', nextPage);
  els.edgeLeft.addEventListener('click', prevPage);

  // 화 이동 버튼
  els.nextCh.addEventListener('click', goNextChapter);
  els.prevCh.addEventListener('click', function () { goPrevChapter(false); });

  // 키보드
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); nextPage(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevPage(); }
    else if (e.key === ' ') { e.preventDefault(); nextPage(); }
  });

  // 스와이프
  var touchX = null;
  els.stage.addEventListener('touchstart', function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  els.stage.addEventListener('touchend', function (e) {
    if (touchX === null || PREF.mode !== 'paginated') return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { dx < 0 ? nextPage() : prevPage(); }
    touchX = null;
  }, { passive: true });

  // 스크롤 모드 진행도
  window.addEventListener('scroll', function () {
    if (PREF.mode !== 'scroll') return;
  }, { passive: true });

  // 창 크기 변경 → 재계산
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, 150);
  });

  /* ---------------- 설정 패널 동작 ---------------- */
  els.btnSettings.addEventListener('click', function (e) {
    e.stopPropagation();
    els.settingsPanel.classList.toggle('open');
  });
  document.addEventListener('click', function (e) {
    if (!els.settingsPanel.contains(e.target) && e.target !== els.btnSettings) {
      els.settingsPanel.classList.remove('open');
    }
  });

  // 상단 모드 토글 버튼
  els.btnMode.addEventListener('click', function () {
    setMode(PREF.mode === 'paginated' ? 'scroll' : 'paginated');
  });

  function setMode(mode) {
    PREF.mode = mode;
    els.body.setAttribute('data-mode', mode);
    syncSettingButtons();
    state.page = 0;
    requestAnimationFrame(relayout);
  }

  document.querySelectorAll('#seg-mode button').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });

  document.querySelectorAll('#seg-theme button').forEach(function (b) {
    b.addEventListener('click', function () {
      PREF.theme = b.dataset.theme;
      els.body.setAttribute('data-theme', b.dataset.theme);
      syncSettingButtons();
    });
  });

  // 글꼴(고딕/명조) 전환 — 글꼴이 바뀌면 줄 너비/높이가 달라지므로 재계산
  document.querySelectorAll('#seg-fontface button').forEach(function (b) {
    b.addEventListener('click', function () {
      PREF.fontFace = b.dataset.fontface;
      els.body.setAttribute('data-fontface', b.dataset.fontface);
      syncSettingButtons();
      // 웹폰트(명조)가 아직 로드 중이면 로드 완료 후 한 번 더 재계산
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { requestAnimationFrame(relayout); });
      }
      requestAnimationFrame(relayout);
    });
  });

  document.querySelectorAll('#seg-font button').forEach(function (b) {
    b.addEventListener('click', function () {
      var cur = PREF.fontScale;
      var action = b.dataset.font;
      if (action === '+') cur = Math.min(1.6, cur + 0.1);
      else if (action === '-') cur = Math.max(0.8, cur - 0.1);
      else cur = 1;
      PREF.fontScale = Math.round(cur * 10) / 10;
      document.documentElement.style.setProperty(
        '--reader-font-size', (BASE_FONT * PREF.fontScale).toFixed(3) + 'rem');
      requestAnimationFrame(relayout);
    });
  });
})();
