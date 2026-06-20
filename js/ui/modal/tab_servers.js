/* js/ui/modal/tab_servers.js — SERVERS tab (service server/client + action stubs) */
window.TabServers = (() => {

  /* ── Helpers ─────────────────────────────────── */
  function _qosSelectHtml(selectedId) {
    const sel     = selectedId || 'default';
    const builtin = ROS2Schema.BUILTIN_QOS;
    const customs = Object.values(Store.getState().qosProfiles || {});
    const bOpts   = Object.entries(builtin).map(([id, p]) =>
      `<option value="${id}" ${sel === id ? 'selected' : ''}>${p.label}</option>`
    ).join('');
    const cOpts = customs.length
      ? `<optgroup label="── Custom ──">${customs.map(p =>
          `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${p.name}</option>`
        ).join('')}</optgroup>`
      : '';
    return `<select class="row-qos srv-qos" title="QoS Profile">${bOpts}${cOpts}</select>`;
  }

  /* All .srv interfaces as 'pkgName/name.srv' options */
  function _srvFileOptions(selectedId) {
    const state  = Store.getState();
    const ifaces = Object.values(state.interfaces || {}).filter(i => i.type === 'srv');
    if (!ifaces.length) return `<option value="" disabled selected>No .srv interfaces — use Configure Interface</option>`;
    return ifaces.map(i => {
      const pkg   = state.packages[i.package];
      const label = pkg ? `${pkg.name}/${i.name}.srv` : `?/${i.name}.srv`;
      return `<option value="${i.id}" ${selectedId === i.id ? 'selected' : ''}>${label}</option>`;
    }).join('');
  }

  /* All existing service server names across all nodes EXCEPT the editing node */
  function _allServerOptions(editingNodeId, selectedName) {
    const state   = Store.getState();
    const servers = [];
    Object.values(state.nodes).forEach(node => {
      if (node.id === editingNodeId) return;
      (node.serviceServers || []).forEach(srv => {
        if (srv.name) servers.push({ name: srv.name, nodeName: node.name, srvFile: srv.srvFile });
      });
    });
    if (!servers.length) return `<option value="" disabled selected>No servers defined in workspace</option>`;
    return servers.map(s =>
      `<option value="${s.name}" data-srvfile="${s.srvFile || ''}" ${selectedName === s.name ? 'selected' : ''}>${s.name} (${s.nodeName})</option>`
    ).join('');
  }

  /* ── Service Server row ──────────────────────── */
  function _srvServerRow(row) {
    row = row || {};
    return `<div class="list-row srv-row srv-server-entry">
      <div class="srv-row-hdr">
        <span class="row-badge srv-server-badge">SRV SVR</span>
        <input class="row-srv-name" type="text" placeholder="service_name (unique in workspace)"
          value="${row.name || ''}" spellcheck="false" autocomplete="off">
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <label class="srv-detail-label">.srv File</label>
          <select class="row-srv-file srv-select">${_srvFileOptions(row.srvFile || '')}</select>
          <button class="srv-define-btn" title="Define new .srv interface">+ Define .srv</button>
        </div>
        <div class="srv-detail-row">
          <label class="srv-detail-label">Callback Fn</label>
          <input class="row-srv-cb srv-input" type="text" placeholder="handle_request (optional)"
            value="${row.callbackFn || ''}" spellcheck="false">
          <span class="srv-optional-hint">optional</span>
        </div>
        <div class="srv-detail-row">
          <label class="srv-detail-label">QoS Profile</label>
          ${_qosSelectHtml(row.qos || 'default')}
        </div>
      </div>
    </div>`;
  }

  /* ── Service Client row ──────────────────────── */
  function _srvClientRow(row, editingNodeId) {
    row = row || {};
    const ctEnabled  = row.connectTimeout && row.connectTimeout.enabled;
    const srfnEnabled = row.sendRequestFn  && row.sendRequestFn.enabled;
    return `<div class="list-row srv-row srv-client-entry">
      <div class="srv-row-hdr">
        <span class="row-badge srv-client-badge">SRV CLI</span>
        <select class="row-cli-server srv-select" title="Select existing service server">
          ${_allServerOptions(editingNodeId, row.name || '')}
        </select>
        <button class="row-del" title="Remove">×</button>
      </div>
      <div class="srv-row-details">
        <div class="srv-detail-row">
          <label class="srv-detail-label">.srv File</label>
          <input class="row-cli-srvfile srv-input" type="text" readonly
            placeholder="Auto-filled from server" style="opacity:0.5;cursor:default"
            value="${_resolveSrvFileLabel(row.srvFile) || ''}">
        </div>
        <div class="srv-detail-row">
          <label class="srv-detail-label">
            <input type="checkbox" class="srv-checkbox" id="" data-target="cli-timeout"
              ${ctEnabled ? 'checked' : ''}>
            Connect Timeout
          </label>
          <input class="row-cli-timeout srv-input srv-conditional" type="number" min="1"
            placeholder="ms" value="${(ctEnabled && row.connectTimeout.ms) || 5000}"
            ${!ctEnabled ? 'style="display:none"' : ''}>
          <span class="srv-optional-hint">ms</span>
        </div>
        <div class="srv-detail-row">
          <label class="srv-detail-label">
            <input type="checkbox" class="srv-checkbox" data-target="cli-srfn"
              ${srfnEnabled ? 'checked' : ''}>
            Send Request Fn
          </label>
          <input class="row-cli-srfn srv-input srv-conditional" type="text"
            placeholder="send_request (optional)"
            value="${(srfnEnabled && row.sendRequestFn.fn) || ''}"
            ${!srfnEnabled ? 'style="display:none"' : ''}
            spellcheck="false">
        </div>
      </div>
    </div>`;
  }

  /* Resolve interface ID to display label */
  function _resolveSrvFileLabel(ifaceId) {
    if (!ifaceId) return '';
    const state = Store.getState();
    const iface = state.interfaces[ifaceId];
    if (!iface) return '';
    const pkg = state.packages[iface.package];
    return pkg ? `${pkg.name}/${iface.name}.srv` : `${iface.name}.srv`;
  }

  /* ── Action stubs (for layout) ───────────────── */
  function _actionStubRow(role, row) {
    row = row || {};
    return `<div class="list-row srv-row">
      <div class="srv-row-hdr">
        <span class="row-badge ${role === 'act_server' ? 'act-server-badge' : 'act-client-badge'}">${role === 'act_server' ? 'ACT SVR' : 'ACT CLI'}</span>
        <input class="row-srv-name srv-input" type="text" placeholder="action_name" value="${row.name || ''}">
        <input class="row-srv-type srv-input" type="text" placeholder="pkg/action/Type" value="${row.interfaceType || ''}">
        <button class="row-del" title="Remove">×</button>
      </div>
    </div>`;
  }

  /* ── Render ──────────────────────────────────── */
  function render(draft) {
    const nodeId   = draft.id;
    const ssrvRows = (draft.serviceServers || []).map(r => _srvServerRow(r)).join('');
    const scliRows = (draft.serviceClients || []).map(r => _srvClientRow(r, nodeId)).join('');
    const asrvRows = (draft.actionServers  || []).map(r => _actionStubRow('act_server', r)).join('');
    const acliRows = (draft.actionClients  || []).map(r => _actionStubRow('act_client', r)).join('');

    return `
      <div class="modal-form">
        <div class="srv-legend">
          <span class="legend-item"><span class="row-badge srv-server-badge">SRV SVR</span> This node hosts a service</span>
          <span class="legend-item"><span class="row-badge srv-client-badge">SRV CLI</span> This node calls a server</span>
          <button class="srv-shortcut-btn" id="open-iface-modal">🔌 Configure .srv Interfaces</button>
        </div>

        <div class="section-hdr">Service Servers
          <button class="add-row-btn" id="add-ssrv">+ Add</button>
        </div>
        <div id="ssrv-rows">${ssrvRows || '<div class="comms-empty">No service servers — click + Add</div>'}</div>

        <div class="section-hdr" style="margin-top:22px">Service Clients
          <button class="add-row-btn" id="add-scli">+ Add</button>
        </div>
        <div id="scli-rows">${scliRows || '<div class="comms-empty">No service clients — click + Add</div>'}</div>

        <div class="section-hdr" style="margin-top:22px">Action Servers
          <button class="add-row-btn" id="add-asrv">+ Add</button>
        </div>
        <div id="asrv-rows">${asrvRows || '<div class="comms-empty">No action servers</div>'}</div>

        <div class="section-hdr" style="margin-top:20px">Action Clients
          <button class="add-row-btn" id="add-acli">+ Add</button>
        </div>
        <div id="acli-rows">${acliRows || '<div class="comms-empty">No action clients</div>'}</div>
      </div>
    `;
  }

  /* ── Bind ────────────────────────────────────── */
  function bind(draft) {
    const nodeId = draft.id;
    _bindAllRows(nodeId);

    document.getElementById('add-ssrv')?.addEventListener('click', () => _appendSrvServer());
    document.getElementById('add-scli')?.addEventListener('click', () => _appendSrvClient(nodeId));
    document.getElementById('add-asrv')?.addEventListener('click', () => _appendActionRow('asrv-rows', 'act_server'));
    document.getElementById('add-acli')?.addEventListener('click', () => _appendActionRow('acli-rows', 'act_client'));
    document.getElementById('open-iface-modal')?.addEventListener('click', () => Bus.emit('interface-modal:open', { ifaceId: null, type: 'srv' }));
  }

  function _bindAllRows(nodeId) {
    document.querySelectorAll('.srv-server-entry').forEach(row => _bindServerRow(row));
    document.querySelectorAll('.srv-client-entry').forEach(row => _bindClientRow(row, nodeId));
    document.querySelectorAll('.list-row:not(.srv-server-entry):not(.srv-client-entry) .row-del').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.list-row')?.remove());
    });
  }

  function _bindServerRow(row) {
    row.querySelector('.row-del')?.addEventListener('click', () => row.remove());
    row.querySelector('.srv-define-btn')?.addEventListener('click', () => Bus.emit('interface-modal:open', { ifaceId: null, type: 'srv' }));
  }

  function _bindClientRow(row, nodeId) {
    row.querySelector('.row-del')?.addEventListener('click', () => row.remove());

    /* Auto-fill srvFile when server is selected */
    const serverSel = row.querySelector('.row-cli-server');
    const srvFileEl = row.querySelector('.row-cli-srvfile');
    if (serverSel) {
      serverSel.addEventListener('change', () => {
        const opt = serverSel.options[serverSel.selectedIndex];
        const ifaceId = opt?.dataset.srvfile || '';
        if (srvFileEl) srvFileEl.value = _resolveSrvFileLabel(ifaceId);
        srvFileEl?.dataset && (srvFileEl.dataset.ifaceId = ifaceId);
      });
    }

    /* Checkboxes toggle conditional fields */
    row.querySelectorAll('.srv-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const target = cb.dataset.target;
        const field  = row.querySelector(`.row-cli-${target === 'cli-timeout' ? 'timeout' : 'srfn'}`);
        if (field) field.style.display = cb.checked ? '' : 'none';
      });
    });
  }

  function _appendSrvServer() {
    const container = document.getElementById('ssrv-rows');
    const empty     = container.querySelector('.comms-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.innerHTML = _srvServerRow({});
    const row = div.firstElementChild;
    container.appendChild(row);
    _bindServerRow(row);
    row.querySelector('.row-srv-name')?.focus();
  }

  function _appendSrvClient(nodeId) {
    const container = document.getElementById('scli-rows');
    const empty     = container.querySelector('.comms-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.innerHTML = _srvClientRow({}, nodeId);
    const row = div.firstElementChild;
    container.appendChild(row);
    _bindClientRow(row, nodeId);
  }

  function _appendActionRow(containerId, role) {
    const container = document.getElementById(containerId);
    const empty     = container.querySelector('.comms-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.innerHTML = _actionStubRow(role, {});
    const row = div.firstElementChild;
    container.appendChild(row);
    row.querySelector('.row-del')?.addEventListener('click', () => row.remove());
    row.querySelector('.row-srv-name')?.focus();
  }

  /* ── Collect ─────────────────────────────────── */
  function collect() {
    const serviceServers = [];
    document.querySelectorAll('#ssrv-rows .srv-server-entry').forEach(row => {
      const name       = (row.querySelector('.row-srv-name')?.value  || '').trim();
      const srvFile    = row.querySelector('.row-srv-file')?.value    || '';
      const callbackFn = (row.querySelector('.row-srv-cb')?.value    || '').trim();
      const qos        = row.querySelector('.row-qos')?.value         || 'default';
      if (name) serviceServers.push({ name, srvFile, callbackFn, qos });
    });

    const serviceClients = [];
    document.querySelectorAll('#scli-rows .srv-client-entry').forEach(row => {
      const serverSel   = row.querySelector('.row-cli-server');
      const name        = serverSel?.value || '';
      const opt         = serverSel?.options[serverSel.selectedIndex];
      const srvFile     = opt?.dataset.srvfile || row.querySelector('.row-cli-srvfile')?.dataset?.ifaceId || '';
      const ctCb        = row.querySelector('[data-target="cli-timeout"]');
      const srfnCb      = row.querySelector('[data-target="cli-srfn"]');
      const ctMs        = parseInt(row.querySelector('.row-cli-timeout')?.value || 5000);
      const srfnName    = (row.querySelector('.row-cli-srfn')?.value || '').trim();
      if (name) serviceClients.push({
        name,
        srvFile,
        connectTimeout: { enabled: ctCb?.checked || false, ms: ctMs },
        sendRequestFn:  { enabled: srfnCb?.checked || false, fn: srfnName },
      });
    });

    const actionServers = [];
    document.querySelectorAll('#asrv-rows .list-row').forEach(row => {
      const name = (row.querySelector('.row-srv-name')?.value || '').trim();
      const type = (row.querySelector('.row-srv-type')?.value || '').trim();
      if (name) actionServers.push({ name, interfaceType: type });
    });

    const actionClients = [];
    document.querySelectorAll('#acli-rows .list-row').forEach(row => {
      const name = (row.querySelector('.row-srv-name')?.value || '').trim();
      const type = (row.querySelector('.row-srv-type')?.value || '').trim();
      if (name) actionClients.push({ name, interfaceType: type });
    });

    return { serviceServers, serviceClients, actionServers, actionClients };
  }

  return { render, bind, collect };
})();
