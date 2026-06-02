/* =========================================================================
 * protect.js — 강화 복사 차단
 *
 * ⚠️ 안내: 웹 브라우저 특성상 100% 차단은 원천적으로 불가능합니다.
 *    (개발자도구를 끄거나, 소스 보기, 스크린샷 등은 막을 수 없음)
 *    이 스크립트는 일반 독자의 손쉬운 복사/배포를 강하게 억제하는 용도입니다.
 * ========================================================================= */
(function () {
  'use strict';

  // 1) 우클릭(컨텍스트 메뉴) 차단
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  });

  // 2) 텍스트 선택 시작 차단
  document.addEventListener('selectstart', function (e) {
    e.preventDefault();
    return false;
  });

  // 3) 드래그 차단 (텍스트/이미지)
  document.addEventListener('dragstart', function (e) {
    e.preventDefault();
    return false;
  });

  // 4) 복사 / 잘라내기 / 붙여넣기 차단 + 클립보드에 빈 값/경고 주입
  ['copy', 'cut'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', '무단 복제를 금지합니다.');
      }
      return false;
    });
  });

  // 5) 단축키 차단
  document.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();
    var ctrl = e.ctrlKey || e.metaKey; // Win/Mac 모두

    // F12 (개발자도구)
    // if (e.keyCode === 123 || key === 'f12') {
    //   e.preventDefault();
    //   return false;
    // }
    // Ctrl/Cmd + Shift + I / J / C  (개발자도구 / 콘솔 / 요소선택)
    if (ctrl && e.shiftKey && ['i', 'j', 'c'].indexOf(key) !== -1) {
      e.preventDefault();
      return false;
    }
    // Ctrl/Cmd + C(복사) X(잘라내기) S(저장) U(소스보기) P(인쇄) A(전체선택)
    if (ctrl && ['c', 'x', 's', 'u', 'p', 'a'].indexOf(key) !== -1) {
      e.preventDefault();
      return false;
    }
  });

  // 6) 페이지를 떠날 때 클립보드 정리 시도 (부가적)
  //    (보안상 항상 동작하진 않지만, 가능한 환경에서 흔적 최소화)

  console.log('%c복사 방지가 활성화되어 있습니다.', 'color:#b00;font-weight:bold;');
})();
