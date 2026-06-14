/* js/ui/modal/modal.js — Node editor modal orchestrator */
window.Modal = (() => {
  let _nodeId   = null;
  let _draft    = null;
  let _activeTab = 'info';

  const TABS = [
    { id: 'info',      label: 'INFO',            mod: () => TabInfo      },
    { id: 'build',     label: 'BUILD PROPERTIES', mod: () => TabBuild     },
    { id: 'comms',     label: 'COMMUNICATION',    mod: () => TabComms     },
    { id: 'servers',   label: 'SERVERS',          mod: () => TabServers   },
    { id: 'threads',   label: 'THREADS',          mod: () => TabThreads   },
    { id: 'processes', label: 'PROCESSES',        mod: () => TabProcesses },
  ];

  /* ── Build DOM ───────────────────────────────────── */
  function init() {
    document.getElementById('modal-root').innerHTML = `
      <div id="modal-overlay" class="hidden">
        <div id="modal">
          <div id="modal-tabs">
            ${TABS.map(t => `<div class="mtab" data-tab="${t.id}">${t.label}</div>`).join('')}
            <button id="modal-close">✕</button>
          </div>
          <div id="modal-body"></div>
          <div id="modal-footer">
            <div id="modal-error"></div>
            <button id="modal-save">SAVE</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-close').addEventListener('click', close);
    document.getElementById('modal-save').addEventListener('click', save);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) close();
    });

    document.querySelectorAll('.mtab').forEach(tab => {
      tab.addEventListener('click', () => _switchTab(tab.dataset.tab));
    });

    Bus.on('modal:open', ({ nodeId }) => open(nodeId));
  }

  /* ── Open / Close ────────────────────────────────── */
  function open(nodeId) {
    _nodeId    = nodeId;
    _activeTab = 'info';
    const node = Store.getState().nodes[nodeId];
    if (!node) return;
    _draft = JSON.parse(JSON.stringify(node));

    document.getElementById('modal-error').textContent = '';
    document.getElementById('modal-overlay').classList.remove('hidden');
    _renderTabs();
    _renderBody();
  }

  function close() {
    document.getElementById('modal-overlay').classList.add('hidden');
    _draft  = null;
    _nodeId = null;
  }

  /* ── Tab switching ───────────────────────────────── */
  function _renderTabs() {
    document.querySelectorAll('.mtab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === _activeTab);
    });
  }

  function _renderBody() {
    const tab = TABS.find(t => t.id === _activeTab);
    if (!tab) return;
    const mod = tab.mod();
    document.getElementById('modal-body').innerHTML = mod.render(_draft);
    if (mod.bind) mod.bind(_draft);
  }

  function _switchTab(id) {
    if (id === _activeTab) return;
    _collectCurrent();
    _activeTab = id;
    _renderTabs();
    _renderBody();
  }

  function _collectCurrent() {
    const tab = TABS.find(t => t.id === _activeTab);
    if (!tab) return;
    const mod = tab.mod();
    if (mod.collect) Object.assign(_draft, mod.collect());
  }

  /* ── Validation ──────────────────────────────────── */
  function _validate() {
    const errs = [];
    if (!_draft.name || !_draft.name.trim())  errs.push('Node name is required');
    if (!_draft.package)                       errs.push('Package is required');
    if (!_draft.language)                      errs.push('Language is required');
    return errs;
  }

  /* ── Save ────────────────────────────────────────── */
  function save() {
    _collectCurrent();

    const errs = _validate();
    const errEl = document.getElementById('modal-error');

    if (errs.length) {
      errEl.textContent = 'ERROR: ' + errs.join(' · ').toUpperCase();
      /* Flash required fields red */
      ['fb-name', 'fb-pkg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('field-error'); setTimeout(() => el.classList.remove('field-error'), 2000); }
      });
      return;
    }

    errEl.textContent = '';

    /* Mark configured if name changed from default + package set */
    const defaultName = /^node_\d+$/.test(_draft.name);
    _draft.configured = !defaultName && !!_draft.package;

    Store.updateNode(_nodeId, _draft);
    close();
  }

  return { init, open, close };
})();
