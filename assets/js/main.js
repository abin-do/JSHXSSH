/* =========================================================================
 * main.js — 메인(블로그) 화면: chapters.json 을 읽어 화 목록을 그린다.
 *  - 날짜/사진 없이, 라벨(선택) + 제목 + 한 줄 소개만 표시
 * ========================================================================= */
(function () {
  'use strict';

  var listEl = document.getElementById('chapter-list');

  fetch('chapters/chapters.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('chapters.json 을 불러오지 못했습니다 (' + res.status + ')');
      return res.json();
    })
    .then(function (data) {
      if (data.title) {
        document.getElementById('site-title').textContent = data.title;
        document.title = data.title;
      }
      document.getElementById('site-desc').textContent = data.description || '';
      document.getElementById('site-author').textContent =
        data.author ? '글 · ' + data.author : '';

      var chapters = data.chapters || [];
      if (!chapters.length) {
        listEl.innerHTML = '<li class="empty">아직 등록된 화가 없습니다.</li>';
        return;
      }

      listEl.innerHTML = '';
      chapters.forEach(function (ch) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.className = 'chapter-row';
        a.href = 'reader.html?ch=' + encodeURIComponent(ch.id);

        // 라벨(선택): chapters.json 에 "label" 이 있으면 작게 표시
        if (ch.label) {
          var label = document.createElement('span');
          label.className = 'row-label';
          label.textContent = ch.label;
          a.appendChild(label);
        }

        var title = document.createElement('span');
        title.className = 'row-title';
        title.textContent = ch.title || ('제 ' + ch.id + ' 화');
        a.appendChild(title);

        if (ch.summary) {
          var sum = document.createElement('span');
          sum.className = 'row-summary';
          sum.textContent = ch.summary;
          a.appendChild(sum);
        }

        li.appendChild(a);
        listEl.appendChild(li);
      });
    })
    .catch(function (err) {
      listEl.innerHTML = '<li class="empty">목록을 불러올 수 없습니다.<br><small>' +
        err.message + '</small></li>';
      console.error(err);
    });
})();
