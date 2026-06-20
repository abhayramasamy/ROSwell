/* js/ui/fab.js — Floating action button with pick menu */
window.Fab = (() => {
  let _open = false;

  function init() {
    const fab  = document.getElementById('fab');
    const menu = document.getElementById('fab-menu');

    fab.addEventListener('click', e => {
      e.stopPropagation();
      _open = !_open;
      menu.classList.toggle('hidden', !_open);
      fab.classList.toggle('fab-active', _open);
    });

    document.addEventListener('click', () => {
      _open = false;
      menu.classList.add('hidden');
      fab.classList.remove('fab-active');
    });

    menu.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      if (action === 'node')         Store.addNode(Canvas.getViewportCenter());
      if (action === 'package')      Bus.emit('pkg-modal:open',       { pkgId: null });
      if (action === 'topic')        Bus.emit('topic-modal:open',     {});
      if (action === 'bbox')         Bus.emit('bbox:start-draw',      {});
      if (action === 'qos')          Bus.emit('qos-modal:open',       {});
      if (action === 'interface') Bus.emit('interface-modal:open', { ifaceId: null, type: 'srv' });

      _open = false;
      menu.classList.add('hidden');
      fab.classList.remove('fab-active');
    });
  }

  return { init };
})();
