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
    set fontScale(v) { localStorage.setItem('reader.font', String(v)); }
  };

  var BASE_FONT = 1.12; // rem (reader.css 의 --reader-font-size 기본값과 일치)

  function applyPrefs() {
    els.body.setAttribute('data-mode', PREF.mode);
    els.body.setAttribute('data-theme', PREF.theme);
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
  }

  /* ---------------- URL 파라미터 ---------------- */
  function getParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  /* ---------------- 초기 로드 ---------------- */
  applyPrefs();

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
      els.content.style.columnWidth = '';
      els.content.style.transform = '';
      updateProgress();
      return;
    }
    var stageWidth = els.stage.clientWidth;          // 무대 너비 = 한 페이지 너비
    var contentW = Math.min(stageWidth, remToPx(getReaderWidthRem()));
    // 컬럼 한 칸 = 본문 영역 너비. 컬럼 갭은 reader.css 의 48px.
    var gap = 48;
    var colWidth = contentW; // 한 페이지에 한 단
    els.content.style.columnWidth = colWidth + 'px';
    els.content.style.columnGap = gap + 'px';
    els.content.style.width = colWidth + 'px';
    els.content.style.marginLeft = 'auto';
    els.content.style.marginRight = 'auto';

    state.pageStep = colWidth + gap;
    // 전체 페이지 수
    var total = els.content.scrollWidth;
    state.totalPages = Math.max(1, Math.round(total / state.pageStep));
    if (state.page > state.totalPages - 1) state.page = state.totalPages - 1;
    if (state.page < 0) state.page = 0;
    renderPage();
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
