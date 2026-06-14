/* js/ui/modal/tab_servers.js — SERVERS tab */
window.TabServers = (() => {
  function _roleBadge(role) {
    const map = {
      srv_server: { cls: 'srv-server-badge', label: 'SRV SVR' },
      srv_client: { cls: 'srv-client-badge', label: 'SRV CLI' },
      act_server: { cls: 'act-server-badge', label: 'ACT SVR' },
      act_client: { cls: 'act-client-badge', label: 'ACT CLI' },
    };
    const b = map[role] || { cls: '', label: role };
    return `<span class="row-badge ${b.cls}">${b.label}</span>`;
  }

  function _serverRow(role, row) {
    row = row || {};
    return `<div class="list-row comms-row" data-role="${role}">
      <div class="comms-row-main">
        ${_roleBadge(role)}
        <input  class="row-srv-name"  placeholder="service_name"    value="${row.name || ''}">
        <input  class="row-srv-type"  placeholder="pkg/srv/Type"     value="${row.srvType || row.actionType || row.interfaceType || ''}">
        <button class="row-del" title="Remove">×</button>
      </div>
    </div>`;
  }

  function render(draft) {
    const ssrvRows = (draft.serviceServers || []).map(r => _serverRow('srv_server', r)).join('');
    const scliRows = (draft.serviceClients || []).map(r => _serverRow('srv_client', r)).join('');
    const asrvRows = (draft.actionServers  || []).map(r => _serverRow('act_server', r)).join('');
    const acliRows = (draft.actionClients  || []).map(r => _serverRow('act_client', r)).join('');

    return `
      <div class="modal-form">
        <div class="comms-legend">
          <span class="legend-item"><span class="row-badge srv-server-badge">SRV SVR</span> Service Server</span>
          <span class="legend-item"><span class="row-badge srv-client-badge">SRV CLI</span> Service Client</span>
          <span class="legend-item"><span class="row-badge act-server-badge">ACT SVR</span> Action Server</span>
          <span class="legend-item"><span class="row-badge act-client-badge">ACT CLI</span> Action Client</span>
        </div>

        <div class="section-hdr">Service Servers <button class="add-row-btn" id="add-ssrv">+ Add</button></div>
        <div id="ssrv-rows">${ssrvRows || '<div class="comms-empty">No service servers</div>'}</div>

        <div class="section-hdr" style="margin-top:20px">Service Clients <button class="add-row-btn" id="add-scli">+ Add</button></div>
        <div id="scli-rows">${scliRows || '<div class="comms-empty">No service clients</div>'}</div>

        <div class="section-hdr" style="margin-top:20px">Action Servers <button class="add-row-btn" id="add-asrv">+ Add</button></div>
        <div id="asrv-rows">${asrvRows || '<div class="comms-empty">No action servers</div>'}</div>

        <div class="section-hdr" style="margin-top:20px">Action Clients <button class="add-row-btn" id="add-acli">+ Add</button></div>
        <div id="acli-rows">${acliRows || '<div class="comms-empty">No action clients</div>'}</div>
      </div>
    `;
  }

  function _bindDel(rowEl) {
    rowEl.querySelector('.row-del').addEventListener('click', () => rowEl.remove());
  }

  function _appendRow(containerId, role) {
    const container = document.getElementById(containerId);
    const empty = container.querySelector('.comms-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.innerHTML = _serverRow(role, {});
    const row = div.firstElementChild;
    container.appendChild(row);
    _bindDel(row);
    row.querySelector('.row-srv-name')?.focus();
  }

  function bind() {
    document.querySelectorAll('#ssrv-rows .list-row, #scli-rows .list-row, #asrv-rows .list-row, #acli-rows .list-row')
      .forEach(_bindDel);

    document.getElementById('add-ssrv')?.addEventListener('click', () => _appendRow('ssrv-rows', 'srv_server'));
    document.getElementById('add-scli')?.addEventListener('click', () => _appendRow('scli-rows', 'srv_client'));
    document.getElementById('add-asrv')?.addEventListener('click', () => _appendRow('asrv-rows', 'act_server'));
    document.getElementById('add-acli')?.addEventListener('click', () => _appendRow('acli-rows', 'act_client'));
  }

  function _collectSection(containerId) {
    const rows = [];
    document.querySelectorAll(`#${containerId} .list-row`).forEach(row => {
      rows.push({
        name:          (row.querySelector('.row-srv-name')?.value || '').trim(),
        interfaceType: (row.querySelector('.row-srv-type')?.value || '').trim(),
      });
    });
    return rows;
  }

  function collect() {
    return {
      serviceServers: _collectSection('ssrv-rows'),
      serviceClients: _collectSection('scli-rows'),
      actionServers:  _collectSection('asrv-rows'),
      actionClients:  _collectSection('acli-rows'),
    };
  }

  return { render, bind, collect };
})();
