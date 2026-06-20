/* js/ui/modal/modal_interface.js — Configure Interface modal (.srv, .msg) */
window.ModalInterface = (() => {
  let _editingId  = null;   /* null = new, 'I1' = editing */
  let _listType   = 'srv';  /* 'srv' or 'msg' — active tab */
  let _preselPkg  = null;   /* package pre-selected from FAB or sidebar */

  const ROS2_TYPES = [
    'bool','byte','char',
    'float32','float64',
    'int8','uint8','int16','uint16','int32','uint32','int64','uint64',
    'string',
    'bool[]','byte[]','char[]',
    'float32[]','float64[]',
    'int8[]','uint8[]','int16[]','uint16[]','int32[]','uint32[]','int64[]','uint64[]',
    'string[]',
  ];

  /* ── Helpers ─────────────────────────────────── */
  function _typeOpts(sel) {
    return ROS2_TYPES.map(t => `<option value="${t}" ${sel === t ? 'selected' : ''}>${t}</option>`).join('');
  }

  function _varRow(vr, section) {
    vr = vr || {};
    return `<div class="iface-var-row" data-section="${section}">
      <input class="iface-var-name" type="text" placeholder="variable_name" value="${vr.varName || ''}" spellcheck="false">
      <select class="iface-var-type">${_typeOpts(vr.varType || 'int32')}</select>
      <button class="iface-var-del" title="Remove">×</button>
    </div>`;
  }

  /* ── Package dropdown HTML ───────────────────── */
  function _pkgOptions(selectedId) {
    const pkgs = Object.values(Store.getState().packages || {})
      .filter(p => (p.type || 'ament_cmake') === 'ament_cmake');
    if (!pkgs.length) return `<option value="" disabled selected>No ament_cmake packages — create one first</option>`;
    return pkgs.map(p =>
      `<option value="${p.id}" ${(selectedId || _preselPkg) === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');
  }

  /* ── Interface list ──────────────────────────── */
  function _renderList() {
    const state  = Store.getState();
    const ifaces = Object.values(state.interfaces || {}).filter(i => i.type === _listType);
    if (!ifaces.length) return `<div class="iface-list-empty">No .${_listType} interfaces yet.</div>`;
    return ifaces.map(iface => {
      const pkg  = state.packages[iface.package];
      const path = pkg ? `${pkg.name}/${_listType}/${iface.name}.${_listType}` : `?/${iface.name}.${_listType}`;
      let vars;
      if (iface.type === 'srv') {
        vars = `${(iface.request||[]).length} req · ${(iface.response||[]).length} resp`;
      } else if (iface.type === 'action') {
        vars = `${(iface.goal||[]).length} goal · ${(iface.result||[]).length} result · ${(iface.feedback||[]).length} fb`;
      } else {
        vars = `${(iface.fields||[]).length} fields`;
      }
      return `<div class="iface-list-card">
        <div class="iface-list-info">
          <span class="iface-list-path">${path}</span>
          <span class="iface-list-vars">${vars}</span>
        </div>
        <div class="iface-list-actions">
          <button class="iface-list-edit" data-id="${iface.id}">Edit</button>
          <button class="iface-list-del"  data-id="${iface.id}">×</button>
        </div>
      </div>`;
    }).join('');
  }

  /* ── Form HTML ───────────────────────────────── */
  function _formHtml(iface) {
    const isSrv = _listType === 'srv';
    const nameVal  = (iface && iface.name)      || '';
    const pkgVal   = (iface && iface.package)   || _preselPkg || '';

    if (isSrv) {
      const reqRows  = ((iface && iface.request)  || []).map(v => _varRow(v, 'req')).join('');
      const respRows = ((iface && iface.response) || []).map(v => _varRow(v, 'resp')).join('');
      return `
        <div class="iface-form" id="iface-form">
          <div class="iface-section-title">${_editingId ? 'Edit .srv Interface' : 'New .srv Interface'}</div>
          <div class="iface-row-2col">
            <div class="iface-field">
              <label class="iface-label">Interface Type</label>
              <select class="iface-select iface-type-sel" id="if-type" disabled>
                <option value="srv" selected>.srv — Service</option>
              </select>
            </div>
            <div class="iface-field">
              <label class="iface-label">Package (ament_cmake)</label>
              <select class="iface-select" id="if-pkg">${_pkgOptions(pkgVal)}</select>
            </div>
          </div>
          <div class="iface-field">
            <label class="iface-label">Service Name
              <span class="iface-tip" title="Lowercase letter start, alphanumeric only — no underscores, no spaces. e.g. addTwoInts">?</span>
            </label>
            <input id="if-name" class="iface-input" type="text"
              placeholder="e.g. addTwoInts"
              pattern="^[a-z][a-zA-Z0-9]*$"
              value="${nameVal}"
              spellcheck="false"
              autocomplete="off">
            <div class="iface-name-hint">Saved as: <span id="if-name-preview" class="iface-name-preview">${nameVal || '...'}.srv</span></div>
          </div>
          <div class="iface-section-title" style="margin-top:20px">Request Fields
            <button class="iface-add-var-btn" data-section="req">+ Add Field</button>
          </div>
          <div id="iface-req-rows" class="iface-var-list">
            ${reqRows || '<div class="iface-var-empty">No request fields — click + Add Field</div>'}
          </div>
          <div class="iface-separator">━━━ --- (separator) ━━━</div>
          <div class="iface-section-title" style="margin-top:10px">Response Fields
            <button class="iface-add-var-btn" data-section="resp">+ Add Field</button>
          </div>
          <div id="iface-resp-rows" class="iface-var-list">
            ${respRows || '<div class="iface-var-empty">No response fields — click + Add Field</div>'}
          </div>
          <div class="iface-form-footer">
            <button id="if-cancel" class="iface-btn-secondary">Cancel</button>
            <button id="if-save"   class="iface-btn-primary">Save Interface</button>
          </div>
        </div>
      `;
    }

    /* .action form */
    if (_listType === 'action') {
      const goalRows     = ((iface && iface.goal)     || []).map(v => _varRow(v, 'goal')).join('');
      const resultRows   = ((iface && iface.result)   || []).map(v => _varRow(v, 'result')).join('');
      const feedbackRows = ((iface && iface.feedback) || []).map(v => _varRow(v, 'feedback')).join('');
      return `
        <div class="iface-form" id="iface-form">
          <div class="iface-section-title">${_editingId ? 'Edit .action Interface' : 'New .action Interface'}</div>
          <div class="iface-row-2col">
            <div class="iface-field">
              <label class="iface-label">Interface Type</label>
              <select class="iface-select iface-type-sel" id="if-type" disabled>
                <option value="action" selected>.action — Action</option>
              </select>
            </div>
            <div class="iface-field">
              <label class="iface-label">Package (ament_cmake)</label>
              <select class="iface-select" id="if-pkg">${_pkgOptions(pkgVal)}</select>
            </div>
          </div>
          <div class="iface-field">
            <label class="iface-label">Action Name
              <span class="iface-tip" title="Lowercase letter start, alphanumeric only — no underscores, no spaces. e.g. navigate">?</span>
            </label>
            <input id="if-name" class="iface-input" type="text"
              placeholder="e.g. navigate"
              pattern="^[a-z][a-zA-Z0-9]*$"
              value="${nameVal}"
              spellcheck="false"
              autocomplete="off">
            <div class="iface-name-hint">Saved as: <span id="if-name-preview" class="iface-name-preview">${nameVal || '...'}.action</span></div>
          </div>
          <div class="iface-section-title" style="margin-top:20px">Goal Fields
            <button class="iface-add-var-btn" data-section="goal">+ Add Field</button>
          </div>
          <div id="iface-goal-rows" class="iface-var-list">
            ${goalRows || '<div class="iface-var-empty">No goal fields — click + Add Field</div>'}
          </div>
          <div class="iface-separator">━━━ --- ━━━</div>
          <div class="iface-section-title" style="margin-top:10px">Result Fields
            <button class="iface-add-var-btn" data-section="result">+ Add Field</button>
          </div>
          <div id="iface-result-rows" class="iface-var-list">
            ${resultRows || '<div class="iface-var-empty">No result fields — click + Add Field</div>'}
          </div>
          <div class="iface-separator">━━━ --- ━━━</div>
          <div class="iface-section-title" style="margin-top:10px">Feedback Fields
            <button class="iface-add-var-btn" data-section="feedback">+ Add Field</button>
          </div>
          <div id="iface-feedback-rows" class="iface-var-list">
            ${feedbackRows || '<div class="iface-var-empty">No feedback fields — click + Add Field</div>'}
          </div>
          <div class="iface-form-footer">
            <button id="if-cancel" class="iface-btn-secondary">Cancel</button>
            <button id="if-save"   class="iface-btn-primary">Save Interface</button>
          </div>
        </div>
      `;
    }

    /* .msg form */
    const fieldsRows = ((iface && iface.fields) || []).map(v => _varRow(v, 'fields')).join('');
    return `
      <div class="iface-form" id="iface-form">
        <div class="iface-section-title">${_editingId ? 'Edit .msg Interface' : 'New .msg Interface'}</div>
        <div class="iface-row-2col">
          <div class="iface-field">
            <label class="iface-label">Interface Type</label>
            <select class="iface-select iface-type-sel" id="if-type" disabled>
              <option value="msg" selected>.msg — Message</option>
            </select>
          </div>
          <div class="iface-field">
            <label class="iface-label">Package (ament_cmake)</label>
            <select class="iface-select" id="if-pkg">${_pkgOptions(pkgVal)}</select>
          </div>
        </div>
        <div class="iface-field">
          <label class="iface-label">Message Name
            <span class="iface-tip" title="Lowercase letter start, alphanumeric only — no underscores, no spaces. e.g. sensorData">?</span>
          </label>
          <input id="if-name" class="iface-input" type="text"
            placeholder="e.g. sensorData"
            pattern="^[a-z][a-zA-Z0-9]*$"
            value="${nameVal}"
            spellcheck="false"
            autocomplete="off">
          <div class="iface-name-hint">Saved as: <span id="if-name-preview" class="iface-name-preview">${nameVal || '...'}.msg</span></div>
        </div>
        <div class="iface-section-title" style="margin-top:20px">Fields
          <button class="iface-add-var-btn" data-section="fields">+ Add Field</button>
        </div>
        <div id="iface-fields-rows" class="iface-var-list">
          ${fieldsRows || '<div class="iface-var-empty">No fields — click + Add Field</div>'}
        </div>
        <div class="iface-form-footer">
          <button id="if-cancel" class="iface-btn-secondary">Cancel</button>
          <button id="if-save"   class="iface-btn-primary">Save Interface</button>
        </div>
      </div>
    `;
  }

  /* ── Full modal HTML ─────────────────────────── */
  function _html() {
    return `
      <div id="iface-overlay" class="hidden">
        <div id="iface-modal">
          <div class="iface-modal-hdr">
            <span>🔌 CONFIGURE INTERFACE</span>
            <button id="iface-close">✕</button>
          </div>
          <div id="iface-modal-body">
            <div class="iface-type-tabs">
              <button class="iface-tab ${_listType === 'srv'    ? 'iface-tab-active' : ''}" data-tab="srv">.srv</button>
              <button class="iface-tab ${_listType === 'msg'    ? 'iface-tab-active' : ''}" data-tab="msg">.msg</button>
              <button class="iface-tab ${_listType === 'action' ? 'iface-tab-active' : ''}" data-tab="action">.action</button>
            </div>
            <div class="iface-section-title">Existing .${_listType} Interfaces</div>
            <div id="iface-list"></div>
            <div style="margin:8px 0 20px;">
              <button id="iface-new-btn" class="iface-btn-new">+ Define New Interface</button>
            </div>
            <div id="iface-form-wrap"></div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Init ─────────────────────────────────────── */
  function init() {
    document.getElementById('iface-modal-root').innerHTML = _html();
    _bindStatic();
    Bus.on('interface-modal:open', ({ ifaceId, pkgId, type } = {}) => open(ifaceId || null, pkgId || null, type));
    Bus.on('interface:added',   _refreshList);
    Bus.on('interface:updated', _refreshList);
    Bus.on('interface:removed', _refreshList);
    Bus.on('package:added',     _refreshList);
  }

  function _refreshList() {
    const el = document.getElementById('iface-list');
    if (el) el.innerHTML = _renderList();
    _bindListActions();
    _refreshPkgDropdown();
  }

  function _refreshPkgDropdown() {
    const sel = document.getElementById('if-pkg');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = _pkgOptions(cur);
  }

  function _bindStatic() {
    const overlay = document.getElementById('iface-overlay');
    document.getElementById('iface-close')?.addEventListener('click', close);
    overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('iface-new-btn')?.addEventListener('click', () => _openForm(null));
    _bindListActions();

    /* Tab switching */
    document.querySelectorAll('.iface-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.tab;
        if (type === _listType) return;
        _listType = type;
        _closeForm();
        _editingId = null;
        document.getElementById('iface-modal-root').innerHTML = _html();
        _bindStatic();
        _refreshList();
      });
    });
  }

  function _bindListActions() {
    document.querySelectorAll('.iface-list-edit').forEach(btn => {
      btn.addEventListener('click', () => _openForm(btn.dataset.id));
    });
    document.querySelectorAll('.iface-list-del').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.removeInterface(btn.dataset.id);
        if (_editingId === btn.dataset.id) _closeForm();
      });
    });
  }

  function _openForm(ifaceId) {
    _editingId  = ifaceId || null;
    const iface = ifaceId ? Store.getState().interfaces[ifaceId] : null;
    document.getElementById('iface-form-wrap').innerHTML = _formHtml(iface);
    _bindForm();
    document.getElementById('iface-form-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _closeForm() {
    _editingId = null;
    document.getElementById('iface-form-wrap').innerHTML = '';
  }

  /* ── Form binding ─────────────────────────────── */
  function _bindForm() {
    const get = id => document.getElementById(id);

    /* Live name preview */
    get('if-name')?.addEventListener('input', () => {
      const v = (get('if-name')?.value || '').trim();
      const preview = get('if-name-preview');
      if (preview) preview.textContent = (v || '...') + '.' + _listType;
    });

    /* Add variable row buttons */
    document.querySelectorAll('.iface-add-var-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        const containerId = section === 'req'      ? 'iface-req-rows'
                          : section === 'resp'     ? 'iface-resp-rows'
                          : section === 'goal'     ? 'iface-goal-rows'
                          : section === 'result'   ? 'iface-result-rows'
                          : section === 'feedback' ? 'iface-feedback-rows'
                          : 'iface-fields-rows';
        const container   = document.getElementById(containerId);
        const empty       = container.querySelector('.iface-var-empty');
        if (empty) empty.remove();
        const div = document.createElement('div');
        div.innerHTML = _varRow({}, section);
        const row = div.firstElementChild;
        container.appendChild(row);
        _bindVarRowDel(row);
        row.querySelector('.iface-var-name')?.focus();
      });
    });

    /* Bind del on existing rows */
    document.querySelectorAll('.iface-var-row').forEach(_bindVarRowDel);

    get('if-cancel')?.addEventListener('click', _closeForm);
    get('if-save')?.addEventListener('click', _saveForm);
    get('if-name')?.focus();
  }

  function _bindVarRowDel(row) {
    row.querySelector('.iface-var-del')?.addEventListener('click', () => {
      const parent = row.parentElement;
      row.remove();
      if (!parent.querySelector('.iface-var-row')) {
        const section = row.dataset.section;
        const empty   = document.createElement('div');
        empty.className = 'iface-var-empty';
        empty.textContent = 'No fields — click + Add Field';
        parent.appendChild(empty);
      }
    });
  }

  function _saveForm() {
    const get = id => document.getElementById(id);
    const name = (get('if-name')?.value || '').trim();
    const pkgId = get('if-pkg')?.value || '';

    /* Validate name */
    if (!name || !/^[a-z][a-zA-Z0-9]*$/.test(name)) {
      const nameEl = get('if-name');
      nameEl?.classList.add('iface-input-error');
      nameEl?.focus();
      setTimeout(() => nameEl?.classList.remove('iface-input-error'), 2000);
      return;
    }
    if (!pkgId) {
      get('if-pkg')?.classList.add('iface-input-error');
      setTimeout(() => get('if-pkg')?.classList.remove('iface-input-error'), 2000);
      return;
    }

    /* Check name uniqueness (within same package + type) */
    const existing = Object.values(Store.getState().interfaces || {}).find(
      i => i.type === _listType && i.package === pkgId && i.name === name && i.id !== _editingId
    );
    if (existing) {
      const nameEl = get('if-name');
      nameEl?.classList.add('iface-input-error');
      nameEl?.setCustomValidity('Name already used in this package');
      nameEl?.reportValidity();
      setTimeout(() => { nameEl?.classList.remove('iface-input-error'); nameEl?.setCustomValidity(''); }, 2500);
      return;
    }

    /* Collect variables */
    const _collectVars = (containerId) => {
      const vars = [];
      document.querySelectorAll(`#${containerId} .iface-var-row`).forEach(row => {
        const varName = (row.querySelector('.iface-var-name')?.value || '').trim();
        const varType = row.querySelector('.iface-var-type')?.value || 'int32';
        if (varName) vars.push({ varName, varType });
      });
      return vars;
    };

    const data = _listType === 'srv'
      ? {
          type:     'srv',
          package:  pkgId,
          name,
          request:  _collectVars('iface-req-rows'),
          response: _collectVars('iface-resp-rows'),
        }
      : _listType === 'action'
      ? {
          type:     'action',
          package:  pkgId,
          name,
          goal:     _collectVars('iface-goal-rows'),
          result:   _collectVars('iface-result-rows'),
          feedback: _collectVars('iface-feedback-rows'),
        }
      : {
          type:     'msg',
          package:  pkgId,
          name,
          fields:   _collectVars('iface-fields-rows'),
        };

    if (_editingId) {
      Store.updateInterface(_editingId, data);
    } else {
      Store.addInterface(data);
    }
    _closeForm();
    _refreshList();
  }

  /* ── Open / Close ─────────────────────────────── */
  function open(ifaceId, pkgId, type) {
    _listType  = type || 'srv';
    _preselPkg = pkgId || null;
    _editingId = null;
    _closeForm();
    document.getElementById('iface-modal-root').innerHTML = _html();
    _bindStatic();
    _refreshList();
    document.getElementById('iface-overlay')?.classList.remove('hidden');
    if (ifaceId) {
      _openForm(ifaceId);
    } else {
      _closeForm();
    }
  }

  function close() {
    document.getElementById('iface-overlay')?.classList.add('hidden');
    _closeForm();
    _preselPkg = null;
    _editingId = null;
    _listType  = 'srv';
  }

  return { init, open, close };
})();
