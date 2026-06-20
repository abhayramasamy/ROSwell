/* js/ui/modal/modal.js — Node editor modal orchestrator */
window.Modal = (() => {
  let _nodeId    = null;
  let _draft     = null;
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
            <button id="modal-delete" class="modal-delete-btn">🗑 Delete Node</button>
            <div id="modal-error"></div>
            <button id="modal-save">SAVE</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-close').addEventListener('click', close);
    document.getElementById('modal-save').addEventListener('click', save);
    document.getElementById('modal-delete').addEventListener('click', () => {
      if (!_nodeId) return;
      if (!confirm('Delete this node? This cannot be undone.')) return;
      const id = _nodeId;
      close();
      Store.removeNode(id);
    });
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

    const errEl = document.getElementById('modal-error');
    errEl.textContent = '';
    errEl.style.color = '';
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
    if (!_draft.name || !_draft.name.trim()) errs.push('Node name is required');
    if (!_draft.package)                      errs.push('Package is required');
    if (!_draft.language)                     errs.push('Language is required');
    return errs;
  }

  /* ── Save ────────────────────────────────────────── */
  function save() {
    _collectCurrent();

    const errEl = document.getElementById('modal-error');
    errEl.style.color = '';

    /* Structural validation */
    const errs = _validate();
    if (errs.length) {
      errEl.textContent = 'ERROR: ' + errs.join(' · ').toUpperCase();
      ['fb-name', 'fb-pkg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('field-error'); setTimeout(() => el.classList.remove('field-error'), 2000); }
      });
      return;
    }

    /* Topic datatype consistency — BLOCKING */
    const commsErrs = TabComms.validate(_draft.publishers || [], _draft.subscribers || []);
    if (commsErrs.length > 0) {
      errEl.style.color = '#ff4444';
      errEl.textContent = '⚠ TOPIC TYPE CONFLICT: ' + commsErrs[0];
      setTimeout(() => { if (errEl.style.color === 'rgb(255, 68, 68)') { errEl.textContent = ''; errEl.style.color = ''; } }, 5000);
      return;
    }

    /* All good — save */
    errEl.textContent = '';
    const defaultName = /^node_\d+$/.test(_draft.name);
    _draft.configured = !defaultName && !!_draft.package;
    Store.updateNode(_nodeId, _draft);

    /* QoS cross-node compatibility check — NON-BLOCKING WARNING */
    const qosWarns = TabComms.checkQosCompatibility(_draft.publishers || [], _draft.subscribers || [], _nodeId);
    if (qosWarns.length > 0) {
      errEl.style.color = '#FBBF24';
      errEl.textContent = '⚠ QoS: ' + qosWarns[0] + (qosWarns.length > 1 ? ` (+${qosWarns.length - 1} more)` : '');
      /* Show warning for 3 s then auto-close */
      setTimeout(() => close(), 3200);
    } else {
      close();
    }
  }

  return { init, open, close };
})();
