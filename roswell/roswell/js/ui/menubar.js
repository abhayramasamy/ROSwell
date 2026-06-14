/* js/ui/menubar.js — Menu bar (Phase 1: structure only) */
window.MenuBar = (() => {
  function init() {
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => {
        /* Phase 2+: dropdown menus per item */
        console.log('[MenuBar] clicked:', item.dataset.menu);
      });
    });
  }

  return { init };
})();
