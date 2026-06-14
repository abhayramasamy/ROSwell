/* js/main.js — Boot sequence */
(function () {
  const SPLASH_MS = 800;
  const FADE_MS   = 400;

  function bootApp() {
    document.getElementById('app').classList.remove('hidden');
    MenuBar.init();
    Sidebar.init();
    Canvas.init();
    Fab.init();
    Modal.init();
    ModalPackage.init();
    Persistence.init();
  }

  const splash = document.getElementById('splash');
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      bootApp();
    }, FADE_MS);
  }, SPLASH_MS);
})();
