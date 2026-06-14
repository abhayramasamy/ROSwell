/* js/state/store.js — Project state store */
window.Store = (() => {
  let _nodeCounter = 0;
  let _pkgCounter  = 0;

  const _state = {
    meta:     { name: 'untitled', workspaceName: 'untitled_ws', distro: 'humble' },
    nodes:    {},
    packages: {}
  };

  function getState() { return _state; }

  function _newNodeId()  { return 'N' + (++_nodeCounter); }
  function _newPkgId()   { return 'P' + (++_pkgCounter);  }

  function _deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

  /* ── Node mutations ──────────────────────────── */
  function addNode(pos) {
    const id   = _newNodeId();
    const name = 'node_' + _nodeCounter;
    _state.nodes[id] = {
      id, name,
      description:    '',
      language:       'cpp',
      inherits:       null,
      package:        null,
      author:         '',
      license:        '',
      configured:     false,
      publishers:     [],
      subscribers:    [],
      serviceServers: [],
      serviceClients: [],
      actionServers:  [],
      actionClients:  [],
      threading:      { model: 'single', numThreads: 2, callbackGroups: [] },
      timers:         [],
      spinMode:       'spin',
      lifecycle:      false,
      pos: pos || { x: 300, y: 200 }
    };
    Bus.emit('node:added', { nodeId: id });
    return id;
  }

  function duplicateNode(srcId) {
    const src = _state.nodes[srcId];
    if (!src) return null;
    const id = _newNodeId();
    const copy = _deepCopy(src);
    copy.id   = id;
    copy.name = src.name + '_copy';
    copy.pos  = { x: src.pos.x + 40, y: src.pos.y + 40 };
    copy.configured = false;
    _state.nodes[id] = copy;
    Bus.emit('node:added', { nodeId: id });
    return id;
  }

  function removeNode(id) {
    if (!_state.nodes[id]) return;
    const pkg = _state.nodes[id].package;
    if (pkg && _state.packages[pkg]) {
      _state.packages[pkg].nodes = (_state.packages[pkg].nodes || []).filter(n => n !== id);
    }
    delete _state.nodes[id];
    Bus.emit('node:removed', { nodeId: id });
  }

  function updateNode(id, patch) {
    if (!_state.nodes[id]) return;
    const node = _state.nodes[id];
    const oldPkg = node.package;
    const newPkg = patch.package !== undefined ? patch.package : oldPkg;

    Object.assign(node, patch);

    /* Sync package.nodes[] when package assignment changes */
    if (newPkg !== oldPkg) {
      if (oldPkg && _state.packages[oldPkg]) {
        _state.packages[oldPkg].nodes = (_state.packages[oldPkg].nodes || []).filter(n => n !== id);
      }
      if (newPkg && _state.packages[newPkg]) {
        if (!_state.packages[newPkg].nodes.includes(id))
          _state.packages[newPkg].nodes.push(id);
      }
    }

    Bus.emit('node:updated', { nodeId: id, patch });
  }

  /* ── Package mutations ───────────────────────── */
  function addPackage(name, type, meta) {
    if (!name) return null;
    /* Check if name already exists */
    const existing = Object.values(_state.packages).find(p => p.name === name);
    if (existing) return existing.id;

    const m = meta || {};
    const id = _newPkgId();
    _state.packages[id] = {
      id,
      name,
      type:             type || m.type || 'ament_cmake',
      version:          m.version          || '0.0.0',
      description:      m.description      || '',
      license:          m.license          || 'Apache-2.0',
      maintainer_name:  m.maintainer_name  || '',
      maintainer_email: m.maintainer_email || '',
      dependencies:     m.dependencies     || [],
      nodes: []
    };
    Bus.emit('package:added', { pkgId: id });
    return id;
  }

  function updatePackage(id, patch) {
    if (!_state.packages[id]) return;
    Object.assign(_state.packages[id], patch);
    Bus.emit('package:updated', { pkgId: id, patch });
  }

  function removePackage(id) {
    if (!_state.packages[id]) return;
    /* Unassign all nodes in this package */
    Object.values(_state.nodes).forEach(node => {
      if (node.package === id) node.package = null;
    });
    delete _state.packages[id];
    Bus.emit('package:removed', { pkgId: id });
  }

  function assignNodeToPackage(nodeId, pkgId) {
    const node = _state.nodes[nodeId];
    if (!node) return;
    /* Remove from old package */
    if (node.package && _state.packages[node.package]) {
      _state.packages[node.package].nodes =
        _state.packages[node.package].nodes.filter(n => n !== nodeId);
    }
    node.package = pkgId || null;
    if (pkgId && _state.packages[pkgId]) {
      if (!_state.packages[pkgId].nodes.includes(nodeId))
        _state.packages[pkgId].nodes.push(nodeId);
    }
    Bus.emit('node:updated', { nodeId, patch: { package: pkgId } });
  }

  function updateWorkspaceName(name) {
    const clean = (name || '').trim().replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'untitled_ws';
    _state.meta.workspaceName = clean;
    Bus.emit('workspace:renamed', { workspaceName: clean });
  }

  function resetState() {
    Object.keys(_state.nodes).forEach(k => delete _state.nodes[k]);
    Object.keys(_state.packages).forEach(k => delete _state.packages[k]);
    _state.meta = { name: 'untitled', workspaceName: 'untitled_ws', distro: 'humble' };
    _nodeCounter = 0;
    _pkgCounter  = 0;
  }

  function loadState(obj) {
    resetState();
    if (obj.meta)     Object.assign(_state.meta, obj.meta);
    if (obj.nodes)    Object.assign(_state.nodes,    obj.nodes);
    if (obj.packages) Object.assign(_state.packages, obj.packages);
  }

  return {
    getState,
    addNode, duplicateNode, removeNode, updateNode,
    addPackage, updatePackage, removePackage, assignNodeToPackage,
    updateWorkspaceName,
    resetState, loadState
  };
})();
