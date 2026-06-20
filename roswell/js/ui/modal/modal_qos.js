/* js/ui/modal/modal_qos.js — QoS Profile editor modal */
window.ModalQos = (() => {
  let _editingId = null;   /* null = new, 'Q1' = editing existing */

  const DEFAULT_FORM = {
    name:        '',
    reliability: 'RELIABLE',
    durability:  'VOLATILE',
    history:     'KEEP_LAST',
    depth:       10,
    deadline:    0,
    liveliness:  'AUTOMATIC',
  };

  /* ── Helpers ─────────────────────────────────── */
  function _sel(id, opts, val) {
    return `<select id="${id}" class="qos-select">
      ${opts.map(o => `<option value="${o.v}" ${val === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
    </select>`;
  }

  function _qosSummary(p) {
    const hist = p.history === 'KEEP_ALL' ? 'Keep All' : `Keep Last ${p.depth}`;
    return `${p.reliability} · ${p.durability} · ${hist}`;
  }

  /* ── Profile list card ───────────────────────── */
  function _renderList() {
    const profiles = Object.values(Store.getState().qosProfiles || {});
    if (!profiles.length) {
      return `<div class="qos-empty">No custom profiles yet — create one below.</div>`;
    }
    return profiles.map(p => `
      <div class="qos-profile-card" data-id="${p.id}">
        <div class="qos-card-info">
          <span class="qos-card-name">${p.name}</span>
          <span class="qos-card-summary">${_qosSummary(p)}</span>
        </div>
        <div class="qos-card-actions">
          <button class="qos-card-edit" data-id="${p.id}">Edit</button>
          <button class="qos-card-del"  data-id="${p.id}">×</button>
        </div>
      </div>`).join('');
  }

  /* ── Compatibility hint ──────────────────────── */
  function _hint(rel, dur, hist, deadline, liveliness) {
    const notes = [];
    if (rel === 'BEST_EFFORT') notes.push('⚠ BEST_EFFORT publishers are <b>incompatible</b> with RELIABLE subscribers on the same topic.');
    if (dur === 'TRANSIENT_LOCAL') notes.push('ℹ TRANSIENT_LOCAL: publisher stores messages — late-joining subscribers will receive past data.');
    if (dur === 'VOLATILE' && rel === 'BEST_EFFORT') notes.push('ℹ Common pattern for high-frequency sensor streams (laser, camera, IMU).');
    if (rel === 'RELIABLE' && dur === 'TRANSIENT_LOCAL') notes.push('ℹ RELIABLE + TRANSIENT_LOCAL: strongest guarantee — good for configuration topics.');
    if (hist === 'KEEP_ALL') notes.push('ℹ KEEP_ALL ignores Depth — all messages are kept in memory.');
    if (deadline > 0) notes.push(`ℹ Deadline: both sides must agree on the same deadline window (${deadline} ms).`);
    if (liveliness === 'MANUAL_BY_TOPIC') notes.push('ℹ MANUAL_BY_TOPIC: publisher must call assert_liveliness() periodically.');
    if (!notes.length) notes.push('✓ Default-compatible profile — works with standard subscribers.');
    return notes.map(n => `<div class="qos-hint-line">${n}</div>`).join('');
  }

  /* ── Form HTML ───────────────────────────────── */
  function _formHtml(vals) {
    const v = { ...DEFAULT_FORM, ...(vals || {}) };
    const keepAll = v.history === 'KEEP_ALL';
    return `
      <div class="qos-form" id="qos-form">
        <div class="qos-section-title">${_editingId ? 'Edit Profile' : 'New Profile'}</div>

        <div class="qos-field">
          <label class="qos-label">Name</label>
          <input id="qf-name" class="qos-input" type="text" placeholder="e.g. My Sensor QoS" value="${v.name || ''}">
        </div>

        <div class="qos-row-2col">
          <div class="qos-field">
            <label class="qos-label">Reliability
              <span class="qos-tip" title="RELIABLE guarantees delivery (retries). BEST_EFFORT is fire-and-forget.">?</span>
            </label>
            ${_sel('qf-reliability', [
              { v: 'RELIABLE',    l: 'RELIABLE — delivery guaranteed' },
              { v: 'BEST_EFFORT', l: 'BEST_EFFORT — no retries' },
            ], v.reliability)}
          </div>
          <div class="qos-field">
            <label class="qos-label">Durability
              <span class="qos-tip" title="TRANSIENT_LOCAL stores messages for late subscribers. VOLATILE does not.">?</span>
            </label>
            ${_sel('qf-durability', [
              { v: 'VOLATILE',        l: 'VOLATILE — no persistence' },
              { v: 'TRANSIENT_LOCAL', l: 'TRANSIENT_LOCAL — store for late joiners' },
            ], v.durability)}
          </div>
        </div>

        <div class="qos-row-2col">
          <div class="qos-field">
            <label class="qos-label">History
              <span class="qos-tip" title="KEEP_LAST keeps only the last N (Depth) messages. KEEP_ALL keeps everything.">?</span>
            </label>
            ${_sel('qf-history', [
              { v: 'KEEP_LAST', l: 'KEEP_LAST (use Depth)' },
              { v: 'KEEP_ALL',  l: 'KEEP_ALL (memory limited)' },
            ], v.history)}
          </div>
          <div class="qos-field">
            <label class="qos-label">Depth
              <span class="qos-tip" title="Number of messages to keep. Only applies when History = KEEP_LAST.">?</span>
            </label>
            <input id="qf-depth" class="qos-input" type="number" min="1" max="10000" value="${v.depth}" ${keepAll ? 'disabled style="opacity:0.35"' : ''}>
          </div>
        </div>

        <div class="qos-row-2col">
          <div class="qos-field">
            <label class="qos-label">Deadline (ms)
              <span class="qos-tip" title="Max time between messages. 0 = no deadline. Both pub and sub must use the same value.">?</span>
            </label>
            <input id="qf-deadline" class="qos-input" type="number" min="0" value="${v.deadline}" placeholder="0 = none">
          </div>
          <div class="qos-field">
            <label class="qos-label">Liveliness
              <span class="qos-tip" title="AUTOMATIC: ROS2 manages heartbeat. MANUAL_BY_TOPIC: publisher calls assert_liveliness().">?</span>
            </label>
            ${_sel('qf-liveliness', [
              { v: 'AUTOMATIC',        l: 'AUTOMATIC' },
              { v: 'MANUAL_BY_TOPIC',  l: 'MANUAL_BY_TOPIC' },
            ], v.liveliness)}
          </div>
        </div>

        <div class="qos-hints" id="qos-hints">
          ${_hint(v.reliability, v.durability, v.history, v.deadline, v.liveliness)}
        </div>

        <div class="qos-form-footer">
          <button id="qf-cancel" class="qos-btn-secondary">Cancel</button>
          <button id="qf-save"   class="qos-btn-primary">Save Profile</button>
        </div>
      </div>
    `;
  }

  /* ── Full modal HTML ─────────────────────────── */
  function _html() {
    return `
      <div id="qos-overlay" class="hidden">
        <div id="qos-modal">
          <div class="qos-modal-hdr">
            <span>⚙ QoS PROFILES</span>
            <button id="qos-close">✕</button>
          </div>
          <div id="qos-modal-body">
            <div class="qos-section-title">Custom Profiles</div>
            <div id="qos-profile-list">${_renderList()}</div>
            <div class="qos-add-trigger">
              <button id="qos-new-btn" class="qos-btn-new">+ Create New Profile</button>
            </div>
            <div id="qos-form-wrap"></div>
          </div>
          <div class="qos-builtin-info">
            <span class="qos-builtin-label">Built-in presets:</span>
            <span class="qos-builtin-tags">default · sensor_data · services_default · parameters · parameter_events</span>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Init ─────────────────────────────────────── */
  function init() {
    document.getElementById('qos-modal-root').innerHTML = _html();
    _bindStatic();
    Bus.on('qos-modal:open', ({ editId } = {}) => open(editId || null));
    Bus.on('qos-profile:added',   _refreshList);
    Bus.on('qos-profile:updated', _refreshList);
    Bus.on('qos-profile:removed', _refreshList);
  }

  function _refreshList() {
    const list = document.getElementById('qos-profile-list');
    if (list) list.innerHTML = _renderList();
    _bindListActions();
  }

  function _bindStatic() {
    const overlay = document.getElementById('qos-overlay');
    document.getElementById('qos-close')?.addEventListener('click', close);
    overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('qos-new-btn')?.addEventListener('click', () => _openForm(null));
    _bindListActions();
  }

  function _bindListActions() {
    document.querySelectorAll('.qos-card-edit').forEach(btn => {
      btn.addEventListener('click', () => _openForm(btn.dataset.id));
    });
    document.querySelectorAll('.qos-card-del').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.removeQosProfile(btn.dataset.id);
        if (_editingId === btn.dataset.id) _closeForm();
      });
    });
  }

  function _openForm(profileId) {
    _editingId = profileId || null;
    const vals = profileId ? Store.getState().qosProfiles[profileId] : null;
    document.getElementById('qos-form-wrap').innerHTML = _formHtml(vals);
    _bindForm();
  }

  function _closeForm() {
    _editingId = null;
    document.getElementById('qos-form-wrap').innerHTML = '';
  }

  function _bindForm() {
    const get = id => document.getElementById(id);

    /* Live hint refresh */
    const _updateHints = () => {
      const rel      = get('qf-reliability')?.value || 'RELIABLE';
      const dur      = get('qf-durability')?.value  || 'VOLATILE';
      const hist     = get('qf-history')?.value     || 'KEEP_LAST';
      const deadline = parseInt(get('qf-deadline')?.value || 0);
      const liveliness = get('qf-liveliness')?.value || 'AUTOMATIC';
      const depthEl    = get('qf-depth');
      if (depthEl) depthEl.disabled = hist === 'KEEP_ALL';
      if (depthEl) depthEl.style.opacity = hist === 'KEEP_ALL' ? '0.35' : '1';
      const hintsEl = get('qos-hints');
      if (hintsEl) hintsEl.innerHTML = _hint(rel, dur, hist, deadline, liveliness);
    };

    ['qf-reliability', 'qf-durability', 'qf-history', 'qf-deadline', 'qf-liveliness'].forEach(id => {
      get(id)?.addEventListener('change', _updateHints);
    });
    get('qf-deadline')?.addEventListener('input', _updateHints);

    get('qf-cancel')?.addEventListener('click', _closeForm);
    get('qf-save')?.addEventListener('click', _saveForm);

    get('qf-name')?.focus();
  }

  function _saveForm() {
    const get = id => document.getElementById(id);
    const name = (get('qf-name')?.value || '').trim();
    if (!name) {
      get('qf-name')?.classList.add('qos-input-error');
      get('qf-name')?.focus();
      setTimeout(() => get('qf-name')?.classList.remove('qos-input-error'), 2000);
      return;
    }

    const data = {
      name,
      reliability: get('qf-reliability')?.value || 'RELIABLE',
      durability:  get('qf-durability')?.value  || 'VOLATILE',
      history:     get('qf-history')?.value      || 'KEEP_LAST',
      depth:       Math.max(1, parseInt(get('qf-depth')?.value    || 10)),
      deadline:    Math.max(0, parseInt(get('qf-deadline')?.value || 0)),
      liveliness:  get('qf-liveliness')?.value  || 'AUTOMATIC',
    };

    if (_editingId) {
      Store.updateQosProfile(_editingId, data);
    } else {
      Store.addQosProfile(data);
    }
    _closeForm();
    _refreshList();
  }

  /* ── Open / Close ─────────────────────────────── */
  function open(editId) {
    document.getElementById('qos-overlay')?.classList.remove('hidden');
    _closeForm();
    _refreshList();
    if (editId) _openForm(editId);
  }

  function close() {
    document.getElementById('qos-overlay')?.classList.add('hidden');
    _closeForm();
  }

  return { init, open, close };
})();
