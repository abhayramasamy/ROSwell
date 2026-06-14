/* js/ui/sidebar.js — Sidebar panels with ROS2 file-tree rendering */
window.Sidebar = (() => {
  const pkgTreeEl  = document.getElementById('pkg-tree');
  const nodeListEl = document.getElementById('node-list');
  const pkgPanel   = document.getElementById('pkg-panel');
  const nodePanel  = document.getElementById('nodelist-panel');
  const resizer    = document.getElementById('panel-resizer');

  function init() {
    Bus.on('node:added',      _render);
    Bus.on('node:removed',    _render);
    Bus.on('node:updated',    _render);
    Bus.on('package:added',   _render);
    Bus.on('package:updated', _render);
    Bus.on('package:removed', _render);
    Bus.on('project:loaded',  _render);
    Bus.on('workspace:renamed', _render);

    /* Panel collapse toggles */
    document.getElementById('pkg-panel')?.querySelector('.panel-hdr')
      ?.addEventListener('click', () => _togglePanel('pkg-panel', 'pkg-tree'));
    document.getElementById('nodelist-panel')?.querySelector('.panel-hdr')
      ?.addEventListener('click', () => _togglePanel('nodelist-panel', 'node-list'));

    /* Panel resizer */
    _initResizer();
  }

  /* ── Panel resizer ────────────────────────────── */
  function _initResizer() {
    if (!resizer) return;
    let dragging = false;
    let startY = 0, startH = 0;

    resizer.addEventListener('mousedown', e => {
      dragging = true;
      startY = e.clientY;
      startH = pkgPanel.getBoundingClientRect().height;
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const delta = e.clientY - startY;
      const newH = Math.max(80, Math.min(startH + delta, window.innerHeight - 200));
      pkgPanel.style.maxHeight = newH + 'px';
      pkgPanel.style.flex = 'none';
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        document.body.style.cursor = '';
      }
    });
  }

  function _togglePanel(panelId, bodyId) {
    const body   = document.getElementById(bodyId);
    const toggle = document.querySelector(`#${panelId} .panel-toggle`);
    if (!body) return;
    const collapsed = body.classList.toggle('panel-collapsed');
    if (toggle) toggle.textContent = collapsed ? '▶' : '▼';
  }

  function _langIcon(lang) { return lang === 'python' ? '🐍' : '⚙'; }

  /* ── File tree helpers ─────────────────────────── */
  function _fileRow(name, depth, opts = {}) {
    const isDir   = opts.dir || false;
    const nodeId  = opts.nodeId || null;
    const icon    = isDir ? '📁' : _fileIcon(name);
    const last    = opts.last ? '└─' : '├─';
    const indent  = '&nbsp;'.repeat(depth * 4);
    const editBtn = nodeId
      ? `<button class="tree-edit-btn" data-id="${nodeId}">Edit</button>`
      : '';
    return `
      <div class="tree-file-row${isDir ? ' tree-dir-row' : ''}${nodeId ? ' tree-node-file' : ''}"
           ${nodeId ? `data-id="${nodeId}"` : ''}>
        <span class="tree-file-indent">${indent}<span class="tree-conn">${last}</span></span>
        <span class="tree-file-icon">${icon}</span>
        <span class="tree-file-name">${name}</span>
        ${editBtn}
      </div>`;
  }

  function _fileIcon(name) {
    if (name.endsWith('.cpp') || name.endsWith('.hpp') || name.endsWith('.h')) return '🔷';
    if (name.endsWith('.py'))  return '🐍';
    if (name === 'CMakeLists.txt') return '🔨';
    if (name === 'package.xml')    return '📄';
    if (name === 'setup.py')       return '⚙';
    if (name === 'setup.cfg')      return '⚙';
    if (name === '__init__.py')    return '🔹';
    return '📄';
  }

  /* ── Workspace rename ───────────────────────────── */
  function _bindWorkspaceRename() {
    const btn = document.getElementById('tree-ws-rename-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const nameEl = document.getElementById('tree-ws-name');
      if (!nameEl) return;
      const current = nameEl.textContent;
      const clean = current.replace(/_ws$/i, '');
      nameEl.innerHTML = `<input id="ws-rename-input" type="text" value="${clean}" style="font-size:11px;font-weight:700;background:rgba(0,0,0,0.2);border:1px solid #444;color:#ddd;padding:1px 4px;border-radius:3px;width:100px;">`;
      const input = document.getElementById('ws-rename-input');
      input.focus();
      input.select();
      const _save = () => {
        const raw = input.value.trim();
        if (raw) Store.updateWorkspaceName(raw);
        else _renderPkgTree();
      };
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { _save(); }
        if (e.key === 'Escape') { _renderPkgTree(); }
      });
      input.addEventListener('blur', _save);
    });
  }

  /* ── Package file tree ──────────────────────────── */
  function _renderPkgTree() {
    const state    = Store.getState();
    const packages = Object.values(state.packages);

    if (!packages.length) {
      pkgTreeEl.innerHTML = '<div class="tree-empty">No packages yet</div>';
      return;
    }

    const meta = state.meta || {};
    const wsName = (meta.workspaceName || 'untitled_ws').toUpperCase() + '_WS';

    let html = `
      <div class="tree-ws-root">
        <span class="tree-ws-icon">🗂</span>
        <span class="tree-ws-name" id="tree-ws-name">${wsName}</span>
        <button class="tree-ws-rename" id="tree-ws-rename-btn" title="Rename workspace">✎</button>
      </div>
      <div class="tree-ws-body">
        <div class="tree-file-row tree-dir-row">
          <span class="tree-file-indent"><span class="tree-conn">└─</span></span>
          <span class="tree-file-icon">📁</span>
          <span class="tree-file-name">src/</span>
        </div>`;

    packages.forEach((pkg, pi) => {
      const pkgNodes = (pkg.nodes || [])
        .map(nid => state.nodes[nid])
        .filter(Boolean);
      const isCpp    = (pkg.type || 'ament_cmake') === 'ament_cmake';
      const isLast   = pi === packages.length - 1;
      const pkgConn  = isLast ? '└─' : '├─';

      html += `
        <div class="tree-pkg" data-pkg-id="${pkg.id}">
          <div class="tree-pkg-hdr">
            <span class="tree-pkg-indent">&nbsp;&nbsp;&nbsp;&nbsp;<span class="tree-conn">${pkgConn}</span></span>
            <span class="tree-pkg-icon">📦</span>
            <span class="tree-pkg-name">${pkg.name}</span>
            <span class="tree-pkg-type">${isCpp ? 'cmake' : 'python'}</span>
            <button class="tree-pkg-edit" data-pkg="${pkg.id}" title="Edit package">✎</button>
          </div>
          <div class="tree-pkg-body">`;

      if (isCpp) {
        html += _renderCppTree(pkg, pkgNodes);
      } else {
        html += _renderPyTree(pkg, pkgNodes);
      }

      html += `</div></div>`;
    });

    html += `</div>`;
    pkgTreeEl.innerHTML = html;

    /* Bind interactions */
    pkgTreeEl.querySelectorAll('.tree-edit-btn[data-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Bus.emit('modal:open', { nodeId: btn.dataset.id });
      });
    });
    pkgTreeEl.querySelectorAll('.tree-pkg-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Bus.emit('pkg-modal:open', { pkgId: btn.dataset.pkg });
      });
    });
    pkgTreeEl.querySelectorAll('.tree-node-file').forEach(row => {
      row.addEventListener('dblclick', () => {
        const id = row.dataset.id;
        if (id) Bus.emit('modal:open', { nodeId: id });
      });
    });
    _bindWorkspaceRename();
  }

  /* ── C++ (ament_cmake) tree ─────────────────────── */
  function _renderCppTree(pkg, nodes) {
    const d = 2;
    let rows = '';
    const srcFiles = nodes.map(n => ({ name: n.name + '.cpp', nodeId: n.id }));

    const allItems = [
      { name: 'CMakeLists.txt',          dir: false },
      { name: 'package.xml',             dir: false },
      { name: 'include/',                dir: true  },
      { name: pkg.name + '/',            dir: true, sub: true },
      { name: 'src/',                    dir: true  },
    ];

    allItems.forEach((item, i) => {
      const isLastGroup = i === allItems.length - 1;
      const last = isLastGroup && srcFiles.length === 0;
      const extra = item.sub ? '&nbsp;'.repeat(d * 4) + '&nbsp;&nbsp;&nbsp;&nbsp;' : '&nbsp;'.repeat(d * 4);
      const conn  = last ? '└─' : '├─';
      rows += `
        <div class="tree-file-row tree-dir-row">
          <span class="tree-file-indent">${extra}<span class="tree-conn">${conn}</span></span>
          <span class="tree-file-icon">${item.dir ? '📁' : _fileIcon(item.name)}</span>
          <span class="tree-file-name">${item.name}</span>
        </div>`;
    });

    srcFiles.forEach((f, i) => {
      const last = i === srcFiles.length - 1;
      const indent = '&nbsp;'.repeat((d + 1) * 4);
      const conn   = last ? '└─' : '├─';
      rows += `
        <div class="tree-file-row tree-node-file" data-id="${f.nodeId}">
          <span class="tree-file-indent">${indent}<span class="tree-conn">${conn}</span></span>
          <span class="tree-file-icon">🔷</span>
          <span class="tree-file-name">${f.name}</span>
          <button class="tree-edit-btn" data-id="${f.nodeId}">Edit</button>
        </div>`;
    });

    if (!srcFiles.length) {
      rows += `<div class="tree-empty-pkg">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(no nodes yet)</div>`;
    }

    return rows;
  }

  /* ── Python (ament_python) tree ─────────────────── */
  function _renderPyTree(pkg, nodes) {
    const d = 2;
    let rows = '';
    const pyFiles = nodes.map(n => ({ name: n.name + '.py', nodeId: n.id }));

    const topFiles = [
      { name: 'package.xml', dir: false },
      { name: 'setup.py',    dir: false },
      { name: 'setup.cfg',   dir: false },
      { name: 'resource/',   dir: true  },
    ];

    topFiles.forEach((item, i) => {
      const indent = '&nbsp;'.repeat(d * 4);
      const last   = i === topFiles.length - 1 && pyFiles.length === 0;
      const conn   = last ? '└─' : '├─';
      rows += `
        <div class="tree-file-row${item.dir ? ' tree-dir-row' : ''}">
          <span class="tree-file-indent">${indent}<span class="tree-conn">${conn}</span></span>
          <span class="tree-file-icon">${item.dir ? '📁' : _fileIcon(item.name)}</span>
          <span class="tree-file-name">${item.name}</span>
        </div>`;
    });

    /* resource/pkg_name file */
    rows += `
      <div class="tree-file-row">
        <span class="tree-file-indent">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="tree-conn">└─</span></span>
        <span class="tree-file-icon">📄</span>
        <span class="tree-file-name">${pkg.name}</span>
      </div>`;

    /* pkg_name/ directory */
    const dirConn = pyFiles.length ? '├─' : '└─';
    rows += `
      <div class="tree-file-row tree-dir-row">
        <span class="tree-file-indent">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="tree-conn">${dirConn}</span></span>
        <span class="tree-file-icon">📁</span>
        <span class="tree-file-name">${pkg.name}/</span>
      </div>
      <div class="tree-file-row">
        <span class="tree-file-indent">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="tree-conn">├─</span></span>
        <span class="tree-file-icon">🔹</span>
        <span class="tree-file-name">__init__.py</span>
      </div>`;

    pyFiles.forEach((f, i) => {
      const last   = i === pyFiles.length - 1;
      const indent = '&nbsp;'.repeat((d + 3) * 4);
      const conn   = last ? '└─' : '├─';
      rows += `
        <div class="tree-file-row tree-node-file" data-id="${f.nodeId}">
          <span class="tree-file-indent">${indent}<span class="tree-conn">${conn}</span></span>
          <span class="tree-file-icon">🐍</span>
          <span class="tree-file-name">${f.name}</span>
          <button class="tree-edit-btn" data-id="${f.nodeId}">Edit</button>
        </div>`;
    });

    if (!pyFiles.length) {
      rows += `<div class="tree-empty-pkg">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(no nodes yet)</div>`;
    }

    return rows;
  }

  /* ── Node list ──────────────────────────────────── */
  function _renderNodeList() {
    const state = Store.getState();
    const nodes = Object.values(state.nodes);

    if (!nodes.length) {
      nodeListEl.innerHTML = '<div class="tree-empty">No nodes yet</div>';
      return;
    }

    nodeListEl.innerHTML = nodes.map(n => {
      const pkg = n.package ? Object.values(state.packages).find(p => p.id === n.package || p.name === n.package) : null;
      const pkgLabel = pkg
        ? `<span class="nli-pkg">${pkg.name}</span>`
        : `<span class="nli-pkg unassigned">unassigned</span>`;
      return `
        <div class="node-list-item${n.configured ? ' configured' : ''}">
          <span class="nli-lang-dot" title="${n.language}">${_langIcon(n.language)}</span>
          <div class="nli-info">
            <span class="nli-name" title="${n.name}">${n.name}</span>
            ${pkgLabel}
          </div>
          <button class="nli-edit" data-id="${n.id}">Edit</button>
        </div>`;
    }).join('');

    nodeListEl.querySelectorAll('.nli-edit').forEach(btn => {
      btn.addEventListener('click', () => Bus.emit('modal:open', { nodeId: btn.dataset.id }));
    });
  }

  function _render() {
    _renderPkgTree();
    _renderNodeList();
  }

  return { init };
})();
