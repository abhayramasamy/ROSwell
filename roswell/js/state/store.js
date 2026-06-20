/* js/state/store.js — Project state store */
window.Store = (() => {
  let _nodeCounter  = 0;
  let _pkgCounter   = 0;
  let _topicCounter = 0;
  let _boxCounter   = 0;
  let _qosCounter   = 0;
  let _ifaceCounter = 0;

  const _state = {
    meta:        { name: 'untitled', workspaceName: 'untitled_ws', distro: 'humble' },
    nodes:       {},
    packages:    {},
    topics:      {},
    boxes:       {},
    qosProfiles: {},
    interfaces:  {}
  };

  function getState() { return _state; }

  function _newNodeId()  { return 'N'  + (++_nodeCounter);  }
  function _newPkgId()   { return 'P'  + (++_pkgCounter);   }
  function _newTopicId() { return 'T'  + (++_topicCounter); }
  function _newBoxId()   { return 'B'  + (++_boxCounter);   }
  function _newQosId()   { return 'Q'  + (++_qosCounter);   }
  function _newIfaceId() { return 'I'  + (++_ifaceCounter); }

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
    const id   = _newNodeId();
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
    const node   = _state.nodes[id];
    const oldPkg = node.package;
    const newPkg = patch.package !== undefined ? patch.package : oldPkg;
    Object.assign(node, patch);
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

  /* ── Topic mutations ─────────────────────────── */
  function _normalizeTopic(name) {
    const t = (name || '').trim();
    return t.startsWith('/') ? t : '/' + t;
  }

  function addTopic(name, pos) {
    const normalized = _normalizeTopic(name);
    if (!normalized || normalized === '/') return null;
    const existing = Object.values(_state.topics).find(t => t.name === normalized);
    if (existing) return existing.id;
    const id = _newTopicId();
    _state.topics[id] = {
      id,
      name:    normalized,
      msgType: '',
      pos:     pos || { x: 400 + Math.random() * 200, y: 250 + Math.random() * 150 }
    };
    Bus.emit('topic:added', { topicId: id });
    return id;
  }

  function removeTopic(id) {
    if (!_state.topics[id]) return;
    delete _state.topics[id];
    Bus.emit('topic:removed', { topicId: id });
  }

  function updateTopic(id, patch) {
    if (!_state.topics[id]) return;
    Object.assign(_state.topics[id], patch);
    Bus.emit('topic:updated', { topicId: id, patch });
  }

  function findOrCreateTopic(name, pos) {
    const normalized = _normalizeTopic(name);
    if (!normalized || normalized === '/') return null;
    const existing = Object.values(_state.topics).find(t => t.name === normalized);
    if (existing) return existing.id;
    const scatter = pos
      ? { x: pos.x + (Math.random() - 0.5) * 180, y: pos.y + (Math.random() - 0.5) * 100 }
      : { x: 400, y: 280 };
    return addTopic(normalized, scatter);
  }

  /* ── Interface mutations ─────────────────────── */
  function addInterface(data) {
    const id = _newIfaceId();
    _state.interfaces[id] = { id, ...data };
    Bus.emit('interface:added', { ifaceId: id });
    return id;
  }

  function updateInterface(id, patch) {
    if (!_state.interfaces[id]) return;
    Object.assign(_state.interfaces[id], patch);
    Bus.emit('interface:updated', { ifaceId: id });
  }

  function removeInterface(id) {
    if (!_state.interfaces[id]) return;
    delete _state.interfaces[id];
    Bus.emit('interface:removed', { ifaceId: id });
  }

  /* ── QoS Profile mutations ───────────────────── */
  function addQosProfile(data) {
    const id = _newQosId();
    _state.qosProfiles[id] = { id, ...data };
    Bus.emit('qos-profile:added', { qosId: id });
    return id;
  }

  function updateQosProfile(id, patch) {
    if (!_state.qosProfiles[id]) return;
    Object.assign(_state.qosProfiles[id], patch);
    Bus.emit('qos-profile:updated', { qosId: id });
  }

  function removeQosProfile(id) {
    if (!_state.qosProfiles[id]) return;
    delete _state.qosProfiles[id];
    Bus.emit('qos-profile:removed', { qosId: id });
  }

  /* ── Bounding Box mutations ──────────────────── */
  function addBox(data) {
    const id = _newBoxId();
    _state.boxes[id] = { id, ...data };
    Bus.emit('box:added', { boxId: id });
    return id;
  }

  function removeBox(id) {
    if (!_state.boxes[id]) return;
    delete _state.boxes[id];
    Bus.emit('box:removed', { boxId: id });
  }

  function updateBox(id, patch) {
    if (!_state.boxes[id]) return;
    Object.assign(_state.boxes[id], patch);
    Bus.emit('box:updated', { boxId: id, patch });
  }

  /* ── Package mutations ───────────────────────── */
  function addPackage(name, type, meta) {
    if (!name) return null;
    const existing = Object.values(_state.packages).find(p => p.name === name);
    if (existing) return existing.id;
    const m  = meta || {};
    const id = _newPkgId();
    _state.packages[id] = {
      id, name,
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
    Object.values(_state.nodes).forEach(node => {
      if (node.package === id) node.package = null;
    });
    delete _state.packages[id];
    Bus.emit('package:removed', { pkgId: id });
  }

  function assignNodeToPackage(nodeId, pkgId) {
    const node = _state.nodes[nodeId];
    if (!node) return;
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

  /* ── Meta ────────────────────────────────────── */
  function updateWorkspaceName(name) {
    const clean = (name || '').trim().replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'untitled_ws';
    _state.meta.workspaceName = clean;
    Bus.emit('workspace:renamed', { workspaceName: clean });
  }

  /* ── Reset / Load ────────────────────────────── */
  function resetState() {
    Object.keys(_state.nodes).forEach(k       => delete _state.nodes[k]);
    Object.keys(_state.packages).forEach(k    => delete _state.packages[k]);
    Object.keys(_state.topics).forEach(k      => delete _state.topics[k]);
    Object.keys(_state.boxes).forEach(k       => delete _state.boxes[k]);
    Object.keys(_state.qosProfiles).forEach(k => delete _state.qosProfiles[k]);
    Object.keys(_state.interfaces).forEach(k  => delete _state.interfaces[k]);
    _state.meta = { name: 'untitled', workspaceName: 'untitled_ws', distro: 'humble' };
    _nodeCounter = 0; _pkgCounter = 0; _topicCounter = 0; _boxCounter = 0; _qosCounter = 0; _ifaceCounter = 0;
  }

  function loadState(obj) {
    resetState();
    if (obj.meta)        Object.assign(_state.meta,        obj.meta);
    if (obj.nodes)       Object.assign(_state.nodes,       obj.nodes);
    if (obj.packages)    Object.assign(_state.packages,    obj.packages);
    if (obj.topics)      Object.assign(_state.topics,      obj.topics);
    if (obj.boxes)       Object.assign(_state.boxes,       obj.boxes);
    if (obj.qosProfiles) Object.assign(_state.qosProfiles, obj.qosProfiles);
    if (obj.interfaces)  Object.assign(_state.interfaces,  obj.interfaces);
    Object.keys(_state.nodes).forEach(k       => { const n = parseInt(k.slice(1)); if (n > _nodeCounter)  _nodeCounter  = n; });
    Object.keys(_state.packages).forEach(k    => { const n = parseInt(k.slice(1)); if (n > _pkgCounter)   _pkgCounter   = n; });
    Object.keys(_state.topics).forEach(k      => { const n = parseInt(k.slice(1)); if (n > _topicCounter) _topicCounter = n; });
    Object.keys(_state.boxes).forEach(k       => { const n = parseInt(k.slice(1)); if (n > _boxCounter)   _boxCounter   = n; });
    Object.keys(_state.qosProfiles).forEach(k => { const n = parseInt(k.slice(1)); if (n > _qosCounter)   _qosCounter   = n; });
    Object.keys(_state.interfaces).forEach(k  => { const n = parseInt(k.slice(1)); if (n > _ifaceCounter) _ifaceCounter = n; });
  }

  return {
    getState,
    addNode, duplicateNode, removeNode, updateNode,
    addPackage, updatePackage, removePackage, assignNodeToPackage,
    addTopic, removeTopic, updateTopic, findOrCreateTopic,
    addBox, removeBox, updateBox,
    addQosProfile, updateQosProfile, removeQosProfile,
    addInterface, updateInterface, removeInterface,
    updateWorkspaceName,
    resetState, loadState
  };
})();
