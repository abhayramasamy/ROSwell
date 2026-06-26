/* js/ui/modal/tab_servers.js — SERVERS tab
   Two sections: Services (server + client) and Actions (server + client)
   Matches existing IIFE pattern. CSS classes from modal.css (srv-row, etc.)
*/
window.TabServers = (() => {

  /* ── Interface dropdowns ─────────────────────────────────────────── */
  function _ifaceOptions(filterType, selectedId) {
    const ifaces = Object.values(Store.getState().interfaces || {})
      .filter(i => i.type === filterType);
    if (!ifaces.length)
      return `<option value="">-- no ${filterType} interfaces defined --</option>`;
    return `<option value="">-- select interface --</option>` +
      ifaces.map(i => {
        const pkg   = Store.getState().packages[i.package];
        const label = pkg ? `${pkg.name}/${i.name}` : i.name;
        return `<option value="${i.id}" ${selectedId === i.id ? 'selected' : ''}>${label}</option>`;
      }).join('');
  }

  function _refreshIfaceSelects() {
    document.querySelectorAll('.srv-iface-select[data-iface-type]').forEach(sel => {
      const type    = sel.dataset.ifaceType;
      const current = sel.value;
      sel.innerHTML = _ifaceOptions(type, current);
    });
  }

  /* ── Row templates ───────────────────────────────────────────────── */
  function _srvServerRow(row) {
    row = row || {};
    return `<div class="srv-row" data-role="srv-server">
      <div class="srv-row-hdr">
        <span class="row-badge srv-server-badge">SRV SRV</span>
        <input class="row-srv-name srv-input" placeholder="/service_name"
               value="${row.name || ''}" autocomplete="off" spellcheck="false">
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <span class="srv-detail-label">Interface</span>
          <select class="srv-iface-select srv-select" data-iface-type="srv">
            ${_ifaceOptions('srv', row.interfaceId || '')}
          </select>
          <button class="srv-define-btn" data-iface-type="srv">+ Define</button>
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label">Callback</span>
          <input class="srv-cb-input srv-input" placeholder="handle_service"
                 value="${row.callbackName || ''}">
        </div>
      </div>
    </div>`;
  }

  function _srvClientRow(row) {
    row = row || {};
    return `<div class="srv-row" data-role="srv-client">
      <div class="srv-row-hdr">
        <span class="row-badge srv-client-badge">SRV CLI</span>
        <input class="row-srv-name srv-input" placeholder="/service_name"
               value="${row.name || ''}" autocomplete="off" spellcheck="false">
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <span class="srv-detail-label">Interface</span>
          <select class="srv-iface-select srv-select" data-iface-type="srv">
            ${_ifaceOptions('srv', row.interfaceId || '')}
          </select>
          <button class="srv-define-btn" data-iface-type="srv">+ Define</button>
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label srv-optional-hint">Response CB</span>
          <input class="srv-cb-input srv-input" placeholder="response_callback (optional)"
                 value="${row.callbackName || ''}">
        </div>
      </div>
    </div>`;
  }

  function _actServerRow(row) {
    row = row || {};
    return `<div class="srv-row" data-role="act-server">
      <div class="srv-row-hdr">
        <span class="row-badge act-server-badge">ACT SRV</span>
        <input class="row-srv-name srv-input" placeholder="/action_name"
               value="${row.name || ''}" autocomplete="off" spellcheck="false">
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <span class="srv-detail-label">Interface</span>
          <select class="srv-iface-select srv-select" data-iface-type="action">
            ${_ifaceOptions('action', row.interfaceId || '')}
          </select>
          <button class="srv-define-btn" data-iface-type="action">+ Define</button>
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label">Goal CB</span>
          <input class="srv-cb-input srv-input" placeholder="handle_goal"
                 value="${row.callbackName || ''}">
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label">Execute CB</span>
          <input class="srv-exec-input srv-input" placeholder="execute_callback"
                 value="${row.executeCallback || ''}">
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label srv-optional-hint">Cancel CB</span>
          <input class="srv-cancel-input srv-input" placeholder="handle_cancel (optional)"
                 value="${row.cancelCallback || ''}">
        </div>
      </div>
    </div>`;
  }

  function _actClientRow(row) {
    row = row || {};
    return `<div class="srv-row" data-role="act-client">
      <div class="srv-row-hdr">
        <span class="row-badge act-client-badge">ACT CLI</span>
        <input class="row-srv-name srv-input" placeholder="/action_name"
               value="${row.name || ''}" autocomplete="off" spellcheck="false">
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <span class="srv-detail-label">Interface</span>
          <select class="srv-iface-select srv-select" data-iface-type="action">
            ${_ifaceOptions('action', row.interfaceId || '')}
          </select>
          <button class="srv-define-btn" data-iface-type="action">+ Define</button>
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label srv-optional-hint">Result CB</span>
          <input class="srv-cb-input srv-input" placeholder="result_callback (optional)"
                 value="${row.callbackName || ''}">
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label srv-optional-hint">Feedback CB</span>
          <input class="srv-feedback-input srv-input" placeholder="feedback_callback (optional)"
                 value="${row.feedbackCallback || ''}">
        </div>
      </div>
    </div>`;
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  function render(draft) {
    const srvServers = (draft.serviceServers || []).map(_srvServerRow).join('');
    const srvClients = (draft.serviceClients || []).map(_srvClientRow).join('');
    const actServers = (draft.actionServers  || []).map(_actServerRow).join('');
    const actClients = (draft.actionClients  || []).map(_actClientRow).join('');
    const empty = (html) => html || '<div class="comms-empty">None — click + Add</div>';

    return `
      <div class="modal-form">
        <div class="srv-legend">
          <span class="legend-item"><span class="row-badge srv-server-badge">SRV SRV</span> Service Server</span>
          <span class="legend-item"><span class="row-badge srv-client-badge">SRV CLI</span> Service Client</span>
          <span class="legend-item"><span class="row-badge act-server-badge">ACT SRV</span> Action Server</span>
          <span class="legend-item"><span class="row-badge act-client-badge">ACT CLI</span> Action Client</span>
          <button class="srv-shortcut-btn" id="srv-open-iface">🔌 Manage Interfaces</button>
        </div>

        <div class="section-hdr" style="margin-top:16px">
          Services
          <button class="add-row-btn" id="add-srv-server">+ Server</button>
          <button class="add-row-btn" id="add-srv-client">+ Client</button>
        </div>
        <div id="srv-rows">${empty(srvServers + srvClients)}</div>

        <div class="section-hdr" style="margin-top:24px">
          Actions
          <button class="add-row-btn" id="add-act-server">+ Server</button>
          <button class="add-row-btn" id="add-act-client">+ Client</button>
        </div>
        <div id="act-rows">${empty(actServers + actClients)}</div>
      </div>
    `;
  }

  /* ── Row binding ─────────────────────────────────────────────────── */
  let _ifaceHandler = null;

  function _bindRow(rowEl) {
    rowEl.querySelector('.row-del')
      .addEventListener('click', () => rowEl.remove());

    const nameInput = rowEl.querySelector('.row-srv-name');
    nameInput?.addEventListener('input', () => {
      const v = nameInput.value;
      if (v && !v.startsWith('/')) nameInput.value = '/' + v;
    });

    rowEl.querySelectorAll('.srv-define-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        Bus.emit('interface-modal:open', { ifaceId: null, type: btn.dataset.ifaceType }));
    });
  }

  function _appendRow(containerId, html) {
    const container = document.getElementById(containerId);
    const empty     = container.querySelector('.comms-empty');
    if (empty) empty.remove();
    const div       = document.createElement('div');
    div.innerHTML   = html;
    const row       = div.firstElementChild;
    container.appendChild(row);
    _bindRow(row);
    row.querySelector('.row-srv-name')?.focus();
  }

  /* ── Bind ────────────────────────────────────────────────────────── */
  function bind() {
    document.querySelectorAll('#srv-rows .srv-row, #act-rows .srv-row')
      .forEach(_bindRow);

    document.getElementById('add-srv-server')
      ?.addEventListener('click', () => _appendRow('srv-rows', _srvServerRow({})));
    document.getElementById('add-srv-client')
      ?.addEventListener('click', () => _appendRow('srv-rows', _srvClientRow({})));
    document.getElementById('add-act-server')
      ?.addEventListener('click', () => _appendRow('act-rows', _actServerRow({})));
    document.getElementById('add-act-client')
      ?.addEventListener('click', () => _appendRow('act-rows', _actClientRow({})));

    document.getElementById('srv-open-iface')
      ?.addEventListener('click', () =>
        Bus.emit('interface-modal:open', { ifaceId: null, type: 'srv' }));

    if (_ifaceHandler) {
      Bus.off('interface:added',   _ifaceHandler);
      Bus.off('interface:updated', _ifaceHandler);
      Bus.off('interface:removed', _ifaceHandler);
    }
    _ifaceHandler = () => _refreshIfaceSelects();
    Bus.on('interface:added',   _ifaceHandler);
    Bus.on('interface:updated', _ifaceHandler);
    Bus.on('interface:removed', _ifaceHandler);
  }

  /* ── Collect ─────────────────────────────────────────────────────── */
  function collect() {
    const serviceServers = [];
    const serviceClients = [];
    const actionServers  = [];
    const actionClients  = [];

    document.querySelectorAll('#srv-rows .srv-row').forEach(row => {
      const role         = row.dataset.role;
      const name         = (row.querySelector('.row-srv-name')?.value   || '').trim();
      const interfaceId  =  row.querySelector('.srv-iface-select')?.value || '';
      const callbackName = (row.querySelector('.srv-cb-input')?.value   || '').trim();
      if (role === 'srv-server') serviceServers.push({ name, interfaceId, callbackName });
      if (role === 'srv-client') serviceClients.push({ name, interfaceId, callbackName });
    });

    document.querySelectorAll('#act-rows .srv-row').forEach(row => {
      const role            = row.dataset.role;
      const name            = (row.querySelector('.row-srv-name')?.value        || '').trim();
      const interfaceId     =  row.querySelector('.srv-iface-select')?.value    || '';
      const callbackName    = (row.querySelector('.srv-cb-input')?.value        || '').trim();
      const executeCallback = (row.querySelector('.srv-exec-input')?.value      || '').trim();
      const cancelCallback  = (row.querySelector('.srv-cancel-input')?.value    || '').trim();
      const feedbackCallback = (row.querySelector('.srv-feedback-input')?.value || '').trim();
      if (role === 'act-server')
        actionServers.push({ name, interfaceId, callbackName, executeCallback, cancelCallback });
      if (role === 'act-client')
        actionClients.push({ name, interfaceId, callbackName, feedbackCallback });
    });

    if (_ifaceHandler) {
      Bus.off('interface:added',   _ifaceHandler);
      Bus.off('interface:updated', _ifaceHandler);
      Bus.off('interface:removed', _ifaceHandler);
      _ifaceHandler = null;
    }

    return { serviceServers, serviceClients, actionServers, actionClients };
  }

  return { render, bind, collect };
})();
