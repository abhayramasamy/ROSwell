/* js/ui/modal/tab_build.js — BUILD PROPERTIES tab */
window.TabBuild = (() => {
  let _pkgSavedHandler = null;

  function _langPkgMismatch(lang, pkgId) {
    if (!pkgId) return null;
    const pkg = Object.values(Store.getState().packages).find(p => p.id === pkgId || p.name === pkgId);
    if (!pkg) return null;
    if (lang === 'cpp'    && pkg.type === 'ament_python') return `Package "${pkg.name}" is ament_python but language is C++`;
    if (lang === 'python' && pkg.type === 'ament_cmake')  return `Package "${pkg.name}" is ament_cmake but language is Python`;
    return null;
  }

  function render(draft) {
    const nodes    = Object.values(Store.getState().nodes).filter(n => n.id !== draft.id);
    const packages = Object.values(Store.getState().packages);

    const nodeOpts = nodes.map(n =>
      `<option value="${n.id}" ${draft.inherits === n.id ? 'selected' : ''}>${n.name}</option>`
    ).join('');

    const pkgOpts = packages.map(p =>
      `<option value="${p.id}" ${draft.package === p.id ? 'selected' : ''}>${p.name} (${p.type || 'ament_cmake'})</option>`
    ).join('');

    const langOpts = ROS2Schema.LANGUAGES.map(l =>
      `<option value="${l.value}" ${draft.language === l.value ? 'selected' : ''}>${l.label}</option>`
    ).join('');

    const mismatch = _langPkgMismatch(draft.language, draft.package);

    return `
      <div class="modal-form">
        <div class="form-row">
          <label>Node name <span class="req">*</span></label>
          <input id="fb-name" type="text" value="${draft.name || ''}" placeholder="my_node">
        </div>

        <div class="form-row">
          <label>Inherits</label>
          <select id="fb-inherits">
            <option value="">None</option>
            ${nodeOpts}
          </select>
        </div>

        <div class="form-row">
          <label>Coding Language <span class="req">*</span></label>
          <select id="fb-lang">${langOpts}</select>
        </div>

        <div class="form-row">
          <label>Package <span class="req">*</span></label>
          <div class="input-with-btn">
            <select id="fb-pkg">
              <option value="">-- Select package --</option>
              ${pkgOpts}
            </select>
            <button class="add-inline-btn" id="fb-add-pkg" title="Create new package">+</button>
          </div>
        </div>

        <div id="pkg-mismatch-warn" class="field-warn${mismatch ? '' : ' hidden'}">
          ${mismatch ? '⚠ ' + mismatch : ''}
        </div>

        <div class="form-row">
          <label>Author</label>
          <input id="fb-author" type="text" value="${draft.author || ''}" placeholder="Your Name">
        </div>

        <div class="form-row">
          <label>License</label>
          <input id="fb-license" type="text" value="${draft.license || ''}" placeholder="Apache-2.0">
        </div>
      </div>
    `;
  }

  function _checkMismatch() {
    const lang  = document.getElementById('fb-lang')?.value;
    const pkgId = document.getElementById('fb-pkg')?.value;
    const warn  = document.getElementById('pkg-mismatch-warn');
    if (!warn) return;
    const msg = _langPkgMismatch(lang, pkgId);
    if (msg) {
      warn.textContent = '⚠ ' + msg;
      warn.classList.remove('hidden');
    } else {
      warn.classList.add('hidden');
    }
  }

  function bind() {
    document.getElementById('fb-lang')?.addEventListener('change', _checkMismatch);
    document.getElementById('fb-pkg')?.addEventListener('change', _checkMismatch);

    document.getElementById('fb-add-pkg')?.addEventListener('click', () => {
      Bus.emit('pkg-modal:open', { pkgId: null });
    });

    /* Remove any previous handler to prevent accumulation */
    if (_pkgSavedHandler) Bus.off('pkg-modal:saved', _pkgSavedHandler);
    _pkgSavedHandler = ({ id, name, type }) => {
      const sel = document.getElementById('fb-pkg');
      if (!sel) return;
      if (!sel.querySelector(`option[value="${id}"]`)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${name} (${type})`;
        sel.appendChild(opt);
      }
      sel.value = id;
      _checkMismatch();
    };
    Bus.on('pkg-modal:saved', _pkgSavedHandler);
  }

  function collect() {
    return {
      name:     (document.getElementById('fb-name')?.value    || '').trim(),
      inherits:  document.getElementById('fb-inherits')?.value || null,
      language:  document.getElementById('fb-lang')?.value     || 'cpp',
      package:   document.getElementById('fb-pkg')?.value      || null,
      author:   (document.getElementById('fb-author')?.value   || '').trim(),
      license:  (document.getElementById('fb-license')?.value  || '').trim(),
    };
  }

  return { render, bind, collect };
})();
