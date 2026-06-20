/* js/ui/modal/modal_package.js — Package create/edit modal */
window.ModalPackage = (() => {
  let _pkgId = null;

  const LICENSES = [
    'Apache-2.0', 'MIT', 'BSD-3-Clause', 'BSD-2-Clause',
    'LGPL-2.1', 'GPL-3.0', 'MPL-2.0', 'Proprietary', 'TODO'
  ];

  function init() {
    document.getElementById('pkg-modal-root').innerHTML = `
      <div id="pkg-modal-overlay" class="hidden">
        <div id="pkg-modal">
          <div id="pkg-modal-header">
            <span id="pkg-modal-title">New Package</span>
            <button id="pkg-modal-close">✕</button>
          </div>
          <div id="pkg-modal-body">

            <div class="pm-section-label">Build System</div>
            <div class="pm-row-2col">
              <div class="form-row">
                <label>Package name <span class="req">*</span></label>
                <input id="pm-name" type="text" placeholder="my_package" autocomplete="off">
              </div>
              <div class="form-row">
                <label>Build type <span class="req">*</span></label>
                <select id="pm-type">
                  <option value="ament_cmake">ament_cmake (C++)</option>
                  <option value="ament_python">ament_python (Python)</option>
                </select>
              </div>
            </div>
            <div id="pm-type-hint" class="field-hint">
              Use <b>ament_cmake</b> for C++ nodes, <b>ament_python</b> for Python nodes.
            </div>

            <div class="pm-section-label">Package Metadata</div>
            <div class="pm-row-2col">
              <div class="form-row">
                <label>Version</label>
                <input id="pm-version" type="text" placeholder="0.0.0" value="0.0.0" autocomplete="off">
              </div>
              <div class="form-row">
                <label>License</label>
                <select id="pm-license">
                  ${LICENSES.map(l => `<option value="${l}">${l}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <label>Description</label>
              <textarea id="pm-description" rows="2" placeholder="Brief description of this package"></textarea>
            </div>

            <div class="pm-section-label">Maintainer</div>
            <div class="pm-row-2col">
              <div class="form-row">
                <label>Maintainer name</label>
                <input id="pm-maintainer-name" type="text" placeholder="Jane Doe" autocomplete="off">
              </div>
              <div class="form-row">
                <label>Maintainer email</label>
                <input id="pm-maintainer-email" type="email" placeholder="jane@example.com" autocomplete="off">
              </div>
            </div>

            <div class="pm-section-label">Dependencies
              <span class="pm-section-sub">space or comma separated — e.g. rclcpp std_msgs geometry_msgs</span>
            </div>
            <div class="form-row">
              <input id="pm-deps-input" type="text" placeholder="rclcpp std_msgs sensor_msgs" autocomplete="off">
            </div>
            <div id="pm-deps-tags" class="pm-deps-tags"></div>

          </div>
          <div id="pkg-modal-footer">
            <div id="pkg-modal-error"></div>
            <button id="pkg-modal-cancel">Cancel</button>
            <button id="pkg-modal-save">Save Package</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('pkg-modal-close').addEventListener('click', _close);
    document.getElementById('pkg-modal-cancel').addEventListener('click', _close);
    document.getElementById('pkg-modal-save').addEventListener('click', _save);

    document.getElementById('pkg-modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('pkg-modal-overlay')) _close();
    });

    document.getElementById('pm-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') _save();
      if (e.key === 'Escape') _close();
    });

    /* Deps tag input: add on comma/space/enter */
    document.getElementById('pm-deps-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
        e.preventDefault();
        _flushDepsInput();
      }
    });
    document.getElementById('pm-deps-input').addEventListener('blur', _flushDepsInput);

    Bus.on('pkg-modal:open', ({ pkgId }) => _open(pkgId || null));
  }

  /* ── Dependency tag management ────────────────── */
  let _deps = [];

  function _flushDepsInput() {
    const input = document.getElementById('pm-deps-input');
    if (!input) return;
    const raw = input.value.trim().replace(/,/g, ' ');
    raw.split(/\s+/).forEach(d => {
      const t = d.trim();
      if (t && !_deps.includes(t)) _deps.push(t);
    });
    input.value = '';
    _renderDepTags();
  }

  function _renderDepTags() {
    const el = document.getElementById('pm-deps-tags');
    if (!el) return;
    el.innerHTML = _deps.map(d => `
      <span class="pm-dep-tag">
        ${d}
        <button class="pm-dep-remove" data-dep="${d}">×</button>
      </span>`).join('');
    el.querySelectorAll('.pm-dep-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        _deps = _deps.filter(d => d !== btn.dataset.dep);
        _renderDepTags();
      });
    });
  }

  /* ── Open / close ────────────────────────────── */
  function _open(pkgId) {
    _pkgId = pkgId;
    const state = Store.getState();
    const pkg   = pkgId ? Object.values(state.packages).find(p => p.id === pkgId) : null;

    document.getElementById('pkg-modal-title').textContent = pkg ? 'Edit Package' : 'New Package';
    document.getElementById('pm-name').value             = pkg?.name             || '';
    document.getElementById('pm-type').value             = pkg?.type             || 'ament_cmake';
    document.getElementById('pm-version').value          = pkg?.version          || '0.0.0';
    document.getElementById('pm-license').value          = pkg?.license          || 'Apache-2.0';
    document.getElementById('pm-description').value      = pkg?.description      || '';
    document.getElementById('pm-maintainer-name').value  = pkg?.maintainer_name  || '';
    document.getElementById('pm-maintainer-email').value = pkg?.maintainer_email || '';
    document.getElementById('pkg-modal-error').textContent = '';

    _deps = pkg?.dependencies ? [...pkg.dependencies] : [];
    document.getElementById('pm-deps-input').value = '';
    _renderDepTags();

    document.getElementById('pkg-modal-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('pm-name').focus(), 60);
  }

  function _close() {
    document.getElementById('pkg-modal-overlay').classList.add('hidden');
    _pkgId = null;
    _deps  = [];
  }

  /* ── Save ────────────────────────────────────── */
  function _save() {
    _flushDepsInput();

    const nameRaw = (document.getElementById('pm-name')?.value || '').trim();
    const errEl   =  document.getElementById('pkg-modal-error');

    if (!nameRaw) {
      errEl.textContent = 'Package name is required.';
      document.getElementById('pm-name').focus();
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(nameRaw)) {
      errEl.textContent = 'Name must be lowercase, start with a letter, use only a-z 0-9 _.';
      return;
    }

    const meta = {
      name:             nameRaw,
      type:             document.getElementById('pm-type')?.value             || 'ament_cmake',
      version:          document.getElementById('pm-version')?.value          || '0.0.0',
      license:          document.getElementById('pm-license')?.value          || 'Apache-2.0',
      description:      document.getElementById('pm-description')?.value      || '',
      maintainer_name:  document.getElementById('pm-maintainer-name')?.value  || '',
      maintainer_email: document.getElementById('pm-maintainer-email')?.value || '',
      dependencies:     [..._deps],
    };

    let id;
    if (_pkgId) {
      Store.updatePackage(_pkgId, meta);
      id = _pkgId;
    } else {
      id = Store.addPackage(nameRaw, meta.type, meta);
    }

    Bus.emit('pkg-modal:saved', { id, ...meta });
    _close();
  }

  return { init };
})();
