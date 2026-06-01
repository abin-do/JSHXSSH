/* =========================================================================
 * editor.js — 화 작성 도구 (WYSIWYG / 블로그식 편집)
 *  - 보이는 그대로 편집(굵게/기울임/색/소제목/장면전환)
 *  - 오른쪽에 깔끔한 본문 HTML 을 실시간 생성
 *  - 기존 HTML 불러오기, 파일 다운로드/복사, chapters.json 항목 생성
 * ========================================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var editor = $('editor');
  var codeOut = $('code-out');
  var jsonOut = $('json-out');
  var colorPick = $('color-pick');
  var fId = $('f-id'), fDate = $('f-date'), fTitle = $('f-title'), fSummary = $('f-summary');
  var toast = $('toast');

  // 굵게/기울임은 <b>/<i>, 색은 <font color> 로 나오도록 (CSS 스타일 인라인화 끔)
  try { document.execCommand('styleWithCSS', false, false); } catch (e) {}

  // 시작 시 빈 문단 하나
  if (!editor.innerHTML.trim()) editor.innerHTML = '<p><br></p>';

  /* =====================================================================
   * 선택 영역 보존 (버튼/색상 선택기 클릭 시 커서가 풀리지 않도록)
   * ===================================================================== */
  var savedRange = null;
  document.addEventListener('selectionchange', function () {
    var sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  });
  function restoreSelection() {
    editor.focus();
    if (savedRange) {
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  }

  /* =====================================================================
   * HTML 직렬화 (지저분한 contenteditable → 깔끔한 본문 HTML)
   * ===================================================================== */
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function rgbToHex(c) {
    var m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return c;
    function h(n) { return ('0' + parseInt(n, 10).toString(16)).slice(-2); }
    return '#' + h(m[1]) + h(m[2]) + h(m[3]);
  }

  // 인라인 노드 정리 → <strong>/<em>/<span style="color">
  function cleanInline(node) {
    var out = '';
    node.childNodes.forEach(function (child) {
      if (child.nodeType === 3) { // 텍스트
        out += esc(child.nodeValue);
        return;
      }
      if (child.nodeType !== 1) return;
      var tag = child.tagName.toLowerCase();
      var inner = cleanInline(child);

      if (tag === 'br') { out += '<br>'; return; }
      if (tag === 'b' || tag === 'strong') {
        out += inner.trim() ? '<strong>' + inner + '</strong>' : inner;
      } else if (tag === 'i' || tag === 'em') {
        out += inner.trim() ? '<em>' + inner + '</em>' : inner;
      } else if (tag === 'u') {
        out += inner.trim() ? '<u>' + inner + '</u>' : inner;
      } else if (tag === 'font') {
        var fc = child.getAttribute('color') || child.style.color;
        out += (fc && inner.trim())
          ? '<span style="color:' + rgbToHex(fc) + '">' + inner + '</span>' : inner;
      } else if (tag === 'span') {
        var sc = child.style.color;
        out += (sc && inner.trim())
          ? '<span style="color:' + rgbToHex(sc) + '">' + inner + '</span>' : inner;
      } else {
        out += inner; // 알 수 없는 래퍼(div 등)는 벗겨냄
      }
    });
    return out;
  }

  // 블록 단위 직렬화
  function serialize() {
    var blocks = [];
    editor.childNodes.forEach(function (child) {
      if (child.nodeType === 3) {
        var t = child.nodeValue.trim();
        if (t) blocks.push('<p>' + esc(t) + '</p>');
        return;
      }
      if (child.nodeType !== 1) return;
      var tag = child.tagName.toLowerCase();

      if (tag === 'hr') { blocks.push('<hr>'); return; }
      if (tag === 'br') return;

      if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        var ih = cleanInline(child).trim();
        if (ih) blocks.push('<h2>' + ih + '</h2>');
        return;
      }
      // p / div / 기타 블록
      var inner = cleanInline(child).replace(/^(<br>)+|(<br>)+$/g, '').trim();
      if (inner) blocks.push('<p>' + inner + '</p>');
    });
    return blocks.join('\n');
  }

  /* =====================================================================
   * 화면 갱신 (오른쪽 HTML / JSON 만 변경)
   * ===================================================================== */
  function render() {
    var html = serialize();
    codeOut.textContent = html || '(본문이 비어 있습니다)';

    var entry = {
      id: (fId.value || '000').trim(),
      title: (fTitle.value || '').trim(),
      date: (fDate.value || '').trim()
    };
    var summary = (fSummary.value || '').trim();
    if (summary) entry.summary = summary;
    jsonOut.textContent = JSON.stringify(entry, null, 2);
  }
  function currentHtml() { return serialize(); }

  /* =====================================================================
   * 툴바
   * ===================================================================== */
  var toolbar = $('toolbar');
  // 버튼을 눌러도 편집 영역의 선택이 풀리지 않게
  toolbar.addEventListener('mousedown', function (e) {
    if (e.target.closest('button')) e.preventDefault();
  });

  function exec(cmd, val) {
    restoreSelection();
    document.execCommand(cmd, false, val);
    render();
  }

  toolbar.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    switch (btn.dataset.cmd) {
      case 'h2':     exec('formatBlock', 'H2'); break;
      case 'p':      exec('formatBlock', 'P'); break;
      case 'hr':     exec('insertHorizontalRule'); break;
      case 'bold':   exec('bold'); break;
      case 'italic': exec('italic'); break;
      case 'color':  exec('foreColor', colorPick.value); break;
      case 'clear':  exec('removeFormat'); break;
    }
  });

  // 색상 선택기에서 색을 고르면 즉시 적용
  colorPick.addEventListener('input', function () {
    exec('foreColor', colorPick.value);
  });

  /* =====================================================================
   * 붙여넣기 → 깔끔한 문단으로 정리
   * ===================================================================== */
  editor.addEventListener('paste', function (e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;
    var html = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map(function (block) {
      var line = block.replace(/\n/g, ' ').trim();
      return line ? '<p>' + esc(line) + '</p>' : '';
    }).join('');
    document.execCommand('insertHTML', false, html || '<p><br></p>');
    render();
  });

  editor.addEventListener('input', render);

  /* =====================================================================
   * 기존 HTML 불러오기
   * ===================================================================== */
  var importBox = $('import-box');
  $('btn-import-toggle').addEventListener('click', function () {
    importBox.classList.toggle('open');
  });
  $('btn-import-cancel').addEventListener('click', function () {
    importBox.classList.remove('open');
  });
  $('btn-import-load').addEventListener('click', function () {
    var raw = $('import-text').value.trim();
    if (!raw) { showToast('불러올 HTML 을 붙여넣으세요'); return; }
    editor.innerHTML = raw;
    importBox.classList.remove('open');
    $('import-text').value = '';
    render();
    showToast('불러왔습니다 — 이어서 편집하세요');
  });

  /* =====================================================================
   * 복사 / 다운로드
   * ===================================================================== */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { showToast('복사되었습니다'); },
        function () { fallbackCopy(text); });
    } else { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('복사되었습니다'); }
    catch (e) { showToast('복사 실패 — 직접 선택해 복사하세요'); }
    document.body.removeChild(ta);
  }

  $('btn-copy-html').addEventListener('click', function () { copyText(currentHtml()); });
  $('btn-copy-json').addEventListener('click', function () { copyText(jsonOut.textContent); });

  $('btn-download').addEventListener('click', function () {
    var html = currentHtml();
    var id = (fId.value || '000').trim();
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = id + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(id + '.html 다운로드 — chapters/ 폴더에 넣으세요');
  });

  /* ---------- 토스트 ---------- */
  var toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  /* ---------- 이벤트 ---------- */
  [fId, fDate, fTitle, fSummary].forEach(function (el) {
    el.addEventListener('input', render);
  });

  render();
})();
