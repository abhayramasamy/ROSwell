/* js/ui/modal/tab_servers.js — SERVERS tab
   Tasks covered:
   1. Server boxes on canvas (pills) — driven by store data shape + canvas.js
   2. Action name uniqueness + auto-interface-select + no self-client
   3. Advanced properties from action templates
   4. Blue action-link arrows — driven by canvas.js _syncEdges
   5. Action name dropdown in ACT CLIENT from existing action servers
*/
window.TabServers = (() => {

  /* ── Collect all action server names in the WS (excluding this node) ── */
  function _actionServerNames(excludeNodeId) {
    const state = Store.getState();
    const names = [];
    Object.values(state.nodes).forEach(n => {
      if (n.id === excludeNodeId) return;
      (n.actionServers || []).forEach(s => { if (s.name && !names.includes(s.name)) names.push(s.name); });
    });
    return names;
  }

  /* Find which node owns an action server name */
  function _findActionServer(name) {
    const state = Store.getState();
    for (const n of Object.values(state.nodes)) {
      const found = (n.actionServers || []).find(s => s.name === name);
      if (found) return { node: n, server: found };
    }
    return null;
  }

  /* ── Interface dropdowns ─────────────────────── */
  function _ifaceOptions(filterType, selectedId) {
    const ifaces = Object.values(Store.getState().interfaces || {})
      .filter(i => i.type === filterType);
    if (!ifaces.length)
      return `<option value="">-- no ${filterType} interfaces defined --</option>`;
    return `<option value="">-- select interface --</option>` +
      ifaces.map(i => {
        const pkg   = Store.getState().packages[i.package];
        const label = pkg ? `${pkg.name}/${i.name}` : i.name;
        return `<option value="${i.id}" ${selectedId === i.id ? 'selected':''}>${label}</option>`;
      }).join('');
  }

  function _refreshIfaceSelects() {
    document.querySelectorAll('.srv-iface-select[data-iface-type]').forEach(sel => {
      const type = sel.dataset.ifaceType, cur = sel.value;
      sel.innerHTML = _ifaceOptions(type, cur);
    });
  }

  /* ── Advanced toggle html ────────────────────── */
  function _advToggle(id) {
    return `<button class="tmr-toggle adv-toggle" data-adv="${id}" style="margin:6px 0 0 0;font-size:10px">▾ Advanced</button>`;
  }

  /* ── Row templates ───────────────────────────── */
  function _srvServerRow(row) {
    row = row || {};
    return `<div class="srv-row" data-role="srv-server">
      <div class="srv-row-hdr">
        <span class="row-badge srv-server-badge">SRV SRV</span>
        <input class="row-srv-name srv-input" placeholder="/service_name"
               value="${row.name||''}" autocomplete="off" spellcheck="false">
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <span class="srv-detail-label">Interface</span>
          <select class="srv-iface-select srv-select" data-iface-type="srv">
            ${_ifaceOptions('srv', row.interfaceId||'')}
          </select>
          <button class="srv-define-btn" data-iface-type="srv">+ Define</button>
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label">Callback</span>
          <input class="srv-cb-input srv-input" placeholder="handle_service"
                 value="${row.callbackName||''}">
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
               value="${row.name||''}" autocomplete="off" spellcheck="false">
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <span class="srv-detail-label">Interface</span>
          <select class="srv-iface-select srv-select" data-iface-type="srv">
            ${_ifaceOptions('srv', row.interfaceId||'')}
          </select>
          <button class="srv-define-btn" data-iface-type="srv">+ Define</button>
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label srv-optional-hint">Response CB</span>
          <input class="srv-cb-input srv-input" placeholder="response_callback (optional)"
                 value="${row.callbackName||''}">
        </div>
      </div>
    </div>`;
  }

  function _actServerRow(row, currentNodeId) {
    row = row || {};
    const uid = 'adv-as-' + Math.random().toString(36).slice(2,7);
    return `<div class="srv-row" data-role="act-server">
      <div class="srv-row-hdr">
        <span class="row-badge act-server-badge">ACT SRV</span>
        <input class="row-srv-name srv-input" placeholder="/action_name"
               value="${row.name||''}" autocomplete="off" spellcheck="false">
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <span class="srv-detail-label">Interface</span>
          <select class="srv-iface-select srv-select" data-iface-type="action">
            ${_ifaceOptions('action', row.interfaceId||'')}
          </select>
          <button class="srv-define-btn" data-iface-type="action">+ Define</button>
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label">Goal CB</span>
          <input class="srv-cb-input srv-input" placeholder="handle_goal"
                 value="${row.callbackName||''}">
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label">Execute CB</span>
          <input class="srv-exec-input srv-input" placeholder="execute_callback"
                 value="${row.executeCallback||''}">
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label srv-optional-hint">Cancel CB</span>
          <input class="srv-cancel-input srv-input" placeholder="handle_cancel (optional)"
                 value="${row.cancelCallback||''}">
        </div>
        ${_advToggle(uid)}
        <div class="timer-seq hidden" id="${uid}">
          <div class="srv-detail-row" style="margin-top:6px">
            <span class="srv-detail-label">Goal Accept</span>
            <select class="srv-goal-accept srv-select">
              <option value="always" ${(row.goalAccept||'always')==='always'?'selected':''}>Always accept</option>
              <option value="custom" ${row.goalAccept==='custom'?'selected':''}>Custom condition</option>
              <option value="reject" ${row.goalAccept==='reject'?'selected':''}>Always reject</option>
            </select>
          </div>
          <div class="srv-detail-row">
            <span class="srv-detail-label">Timeout</span>
            <label class="toggle-wrap" style="flex:none;margin-right:8px">
              <input type="checkbox" class="srv-timeout-en srv-checkbox" ${row.timeoutEnabled?'checked':''}>
              <span class="toggle-label" style="font-size:11px">Enabled</span>
            </label>
            <input class="srv-timeout-val srv-input" type="number" min="1" placeholder="10" style="width:70px"
                   value="${row.maxExecutionTime||10}">
            <span class="srv-optional-hint" style="font-size:10px;margin-left:4px">sec</span>
          </div>
          <div class="srv-detail-row">
            <span class="srv-detail-label">Loop sleep</span>
            <input class="srv-loop-sleep srv-input" type="number" min="0.01" step="0.01" placeholder="0.1" style="width:70px"
                   value="${row.loopSleep||0.1}">
            <span class="srv-optional-hint" style="font-size:10px;margin-left:4px">sec</span>
          </div>
          <div class="srv-detail-row">
            <span class="srv-detail-label srv-optional-hint">Runtime abort</span>
            <input class="srv-runtime-abort srv-input" placeholder="condition expression (optional)"
                   value="${row.runtimeAbortCondition||''}">
          </div>
        </div>
      </div>
    </div>`;
  }

  function _actClientRow(row, currentNodeId) {
    row = row || {};
    const uid = 'adv-ac-' + Math.random().toString(36).slice(2,7);
    const availableServers = _actionServerNames(currentNodeId);
    const nameOpts = availableServers.length
      ? `<option value="">-- pick action server --</option>` +
        availableServers.map(n => `<option value="${n}" ${row.name===n?'selected':''}>${n}</option>`).join('')
      : `<option value="">-- no action servers defined yet --</option>`;

    return `<div class="srv-row" data-role="act-client">
      <div class="srv-row-hdr">
        <span class="row-badge act-client-badge">ACT CLI</span>
        <select class="row-srv-name-sel srv-select act-name-sel" style="flex:1">
          ${nameOpts}
        </select>
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <span class="srv-detail-label">Interface</span>
          <select class="srv-iface-select srv-select act-cli-iface" data-iface-type="action" disabled>
            ${_ifaceOptions('action', row.interfaceId||'')}
          </select>
          <span class="srv-optional-hint" style="font-size:10px">auto-filled</span>
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label srv-optional-hint">Result CB</span>
          <input class="srv-cb-input srv-input" placeholder="result_callback (optional)"
                 value="${row.callbackName||''}">
        </div>
        <div class="srv-detail-row">
          <span class="srv-detail-label srv-optional-hint">Feedback CB</span>
          <input class="srv-feedback-input srv-input" placeholder="feedback_callback (optional)"
                 value="${row.feedbackCallback||''}">
        </div>
        ${_advToggle(uid)}
        <div class="timer-seq hidden" id="${uid}">
          <div class="srv-detail-row" style="margin-top:6px">
            <span class="srv-detail-label">Server wait</span>
            <input class="srv-wait-timeout srv-input" type="number" min="1" placeholder="5" style="width:70px"
                   value="${row.serverWaitTimeout||5}">
            <span class="srv-optional-hint" style="font-size:10px;margin-left:4px">sec</span>
          </div>
          <div class="srv-detail-row">
            <span class="srv-detail-label">Feedback cancel</span>
            <label class="toggle-wrap" style="flex:none;margin-right:8px">
              <input type="checkbox" class="srv-fb-cancel-en srv-checkbox" ${row.feedbackCancelEnabled?'checked':''}>
              <span class="toggle-label" style="font-size:11px">Enabled</span>
            </label>
          </div>
          <div class="srv-detail-row">
            <span class="srv-detail-label srv-optional-hint">Cancel condition</span>
            <input class="srv-fb-cancel-cond srv-input" placeholder="e.g. feedback.progress > 50"
                   value="${row.feedbackCancelCondition||''}">
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ── Render ──────────────────────────────────── */
  function render(draft) {
    const nodeId     = draft.id;
    const srvServers = (draft.serviceServers||[]).map(r => _srvServerRow(r)).join('');
    const srvClients = (draft.serviceClients||[]).map(r => _srvClientRow(r)).join('');
    const actServers = (draft.actionServers ||[]).map(r => _actServerRow(r, nodeId)).join('');
    const actClients = (draft.actionClients ||[]).map(r => _actClientRow(r, nodeId)).join('');
    const empty = h => h || '<div class="comms-empty">None — click + Add</div>';

    return `<div class="modal-form">
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
    </div>`;
  }

  /* ── Row binding ─────────────────────────────── */
  let _ifaceHandler = null;
  let _currentNodeId = null;

  function _bindAdvToggle(rowEl) {
    rowEl.querySelectorAll('.adv-toggle').forEach(btn => {
      const targetId = btn.dataset.adv;
      const panel    = document.getElementById(targetId);
      if (!panel) return;
      btn.addEventListener('click', () => {
        const hidden = panel.classList.toggle('hidden');
        btn.textContent = hidden ? '▾ Advanced' : '▴ Advanced';
      });
    });
  }

  function _bindActNameSelect(rowEl) {
    const sel = rowEl.querySelector('.act-name-sel');
    if (!sel) return;
    sel.addEventListener('change', () => {
      const name     = sel.value;
      const ifaceSel = rowEl.querySelector('.act-cli-iface');
      if (!ifaceSel) return;
      if (!name) { ifaceSel.innerHTML = _ifaceOptions('action', ''); return; }

      /* uniqueness: warn if another ACT CLIENT in this tab already picked same name */
      const others = [...document.querySelectorAll('#act-rows .act-name-sel')]
        .filter(s => s !== sel && s.value === name);
      if (others.length) {
        sel.style.borderColor = '#ff4444';
        setTimeout(() => sel.style.borderColor = '', 2000);
      } else {
        sel.style.borderColor = '';
      }

      /* Auto-fill interface from the matching action server */
      const found = _findActionServer(name);
      if (found && found.server.interfaceId) {
        ifaceSel.innerHTML = _ifaceOptions('action', found.server.interfaceId);
      }
    });
    /* Trigger on load if value already set */
    if (sel.value) sel.dispatchEvent(new Event('change'));
  }

  function _bindRow(rowEl) {
    rowEl.querySelector('.row-del')
      ?.addEventListener('click', () => rowEl.remove());

    const nameInput = rowEl.querySelector('.row-srv-name');
    nameInput?.addEventListener('input', () => {
      const v = nameInput.value;
      if (v && !v.startsWith('/')) nameInput.value = '/' + v;
    });

    rowEl.querySelectorAll('.srv-define-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        Bus.emit('interface-modal:open', { ifaceId: null, type: btn.dataset.ifaceType }));
    });

    _bindAdvToggle(rowEl);
    _bindActNameSelect(rowEl);
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
    (row.querySelector('.row-srv-name') || row.querySelector('.row-srv-name-sel'))?.focus();
  }

  /* ── Bind ────────────────────────────────────── */
  function bind(draft) {
    _currentNodeId = draft.id;

    document.querySelectorAll('#srv-rows .srv-row, #act-rows .srv-row').forEach(_bindRow);

    document.getElementById('add-srv-server')
      ?.addEventListener('click', () => _appendRow('srv-rows', _srvServerRow({})));
    document.getElementById('add-srv-client')
      ?.addEventListener('click', () => _appendRow('srv-rows', _srvClientRow({})));
    document.getElementById('add-act-server')
      ?.addEventListener('click', () => _appendRow('act-rows', _actServerRow({}, _currentNodeId)));
    document.getElementById('add-act-client')
      ?.addEventListener('click', () => _appendRow('act-rows', _actClientRow({}, _currentNodeId)));

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

  /* ── Collect ─────────────────────────────────── */
  function collect() {
    const serviceServers = [], serviceClients = [];
    const actionServers  = [], actionClients  = [];

    document.querySelectorAll('#srv-rows .srv-row').forEach(row => {
      const role         = row.dataset.role;
      const name         = (row.querySelector('.row-srv-name')?.value   ||'').trim();
      const interfaceId  =  row.querySelector('.srv-iface-select')?.value||'';
      const callbackName = (row.querySelector('.srv-cb-input')?.value   ||'').trim();
      if (role==='srv-server') serviceServers.push({ name, interfaceId, callbackName });
      if (role==='srv-client') serviceClients.push({ name, interfaceId, callbackName });
    });

    document.querySelectorAll('#act-rows .srv-row').forEach(row => {
      const role             = row.dataset.role;
      const interfaceId      =  row.querySelector('.srv-iface-select')?.value   ||'';
      const callbackName     = (row.querySelector('.srv-cb-input')?.value        ||'').trim();

      if (role==='act-server') {
        const name                  = (row.querySelector('.row-srv-name')?.value        ||'').trim();
        const executeCallback       = (row.querySelector('.srv-exec-input')?.value      ||'').trim();
        const cancelCallback        = (row.querySelector('.srv-cancel-input')?.value    ||'').trim();
        const goalAccept            =  row.querySelector('.srv-goal-accept')?.value      ||'always';
        const timeoutEnabled        =  row.querySelector('.srv-timeout-en')?.checked    ||false;
        const maxExecutionTime      = parseFloat(row.querySelector('.srv-timeout-val')?.value||10);
        const loopSleep             = parseFloat(row.querySelector('.srv-loop-sleep')?.value||0.1);
        const runtimeAbortCondition = (row.querySelector('.srv-runtime-abort')?.value   ||'').trim();
        actionServers.push({ name, interfaceId, callbackName, executeCallback, cancelCallback,
                             goalAccept, timeoutEnabled, maxExecutionTime, loopSleep, runtimeAbortCondition });
      }

      if (role==='act-client') {
        const name                  = (row.querySelector('.act-name-sel')?.value        ||'').trim();
        const feedbackCallback      = (row.querySelector('.srv-feedback-input')?.value  ||'').trim();
        const serverWaitTimeout     = parseFloat(row.querySelector('.srv-wait-timeout')?.value||5);
        const feedbackCancelEnabled =  row.querySelector('.srv-fb-cancel-en')?.checked  ||false;
        const feedbackCancelCondition = (row.querySelector('.srv-fb-cancel-cond')?.value||'').trim();
        actionClients.push({ name, interfaceId, callbackName, feedbackCallback,
                             serverWaitTimeout, feedbackCancelEnabled, feedbackCancelCondition });
      }
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
