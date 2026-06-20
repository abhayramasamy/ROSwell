/* js/ui/canvas.js — Cytoscape canvas */
window.Canvas = (() => {
  let cy;
  let _activeNodeId = null;
  let _activeKind   = 'node';

  const CTX     = document.getElementById('ctx-menu');
  const TRIGGER = document.getElementById('node-menu-trigger');

  const STYLE_NODE_DEFAULT    = { bg: '#D95F5F', border: '#B84444', color: '#ffffff' };
  const STYLE_NODE_CONFIGURED = { bg: '#000000', border: '#0ef09d', color: '#0ef09d' };
  const STYLE_NODE_SERVERS    = { bg: '#3b0764', border: '#7c3aed', color: '#e9d5ff' };
  const STYLE_TOPIC           = { bg: '#0EA5E9', border: '#0284C7', color: '#ffffff' };

  /* ── Bounding box color palette ─────────────── */
  const BBOX_COLORS = [
    { name: 'Navy',   bg: '#0f1e35', border: '#1e40af', tab: '#1d4ed8', label: '#93c5fd' },
    { name: 'Forest', bg: '#0a2017', border: '#166534', tab: '#15803d', label: '#86efac' },
    { name: 'Plum',   bg: '#1e0a35', border: '#6b21a8', tab: '#7c3aed', label: '#c4b5fd' },
    { name: 'Rust',   bg: '#2d0a0a', border: '#991b1b', tab: '#b91c1c', label: '#fca5a5' },
    { name: 'Teal',   bg: '#012a2a', border: '#0f766e', tab: '#0d9488', label: '#5eead4' },
    { name: 'Amber',  bg: '#2d1a00', border: '#b45309', tab: '#d97706', label: '#fde68a' },
    { name: 'Rose',   bg: '#2d0a1a', border: '#be185d', tab: '#db2777', label: '#fbcfe8' },
    { name: 'Slate',  bg: '#0f1921', border: '#334155', tab: '#475569', label: '#cbd5e1' },
    { name: 'Cyan',   bg: '#021b25', border: '#0e7490', tab: '#0891b2', label: '#a5f3fc' },
    { name: 'Olive',  bg: '#1a1e00', border: '#4d7c0f', tab: '#65a30d', label: '#d9f99d' },
  ];

  let _bboxActive = false;
  let _bboxColor  = 0;
  let _bboxGeom   = null;

  const TOOLTIP = document.getElementById('canvas-tooltip');
  let _ttTimer  = null;

  function init() {
    cy = cytoscape({
      container: document.getElementById('canvas'),
      elements:  [],
      style: [
        /* Bounding box — BEHIND everything */
        {
          selector: 'node[kind="bbox"]',
          style: {
            'shape':               'rectangle',
            'background-color':    'data(bgColor)',
            'background-opacity':  0.22,
            'border-width':        2,
            'border-color':        'data(borderColor)',
            'label':               'data(label)',
            'color':               'data(labelColor)',
            'font-size':           'data(fontSize)',
            'font-family':         'Segoe UI, system-ui, sans-serif',
            'font-weight':         700,
            'text-valign':         'top',
            'text-halign':         'left',
            'text-margin-y':       -20,
            'text-margin-x':       12,
            'text-background-color':    'data(tabColor)',
            'text-background-opacity':  1,
            'text-background-padding':  '6px',
            'z-index':             0,
          }
        },
        /* Regular node leaf */
        {
          selector: 'node[kind="node"]',
          style: {
            'shape':            'roundrectangle',
            'background-color': STYLE_NODE_DEFAULT.bg,
            'border-width':     2,
            'border-color':     STYLE_NODE_DEFAULT.border,
            'label':            'data(label)',
            'color':            STYLE_NODE_DEFAULT.color,
            'font-size':        13,
            'font-family':      'Segoe UI, system-ui, sans-serif',
            'font-weight':      600,
            'text-valign':      'center',
            'text-halign':      'center',
            'width':            150,
            'height':           65,
            'z-index':          1,
          }
        },
        /* Compound node parent (has server boxes) */
        {
          selector: 'node[kind="node"]:parent',
          style: {
            'background-color': STYLE_NODE_SERVERS.bg,
            'border-color':     STYLE_NODE_SERVERS.border,
            'border-width':     2,
            'color':            STYLE_NODE_SERVERS.color,
            'font-size':        14,
            'font-weight':      700,
            'text-valign':      'top',
            'text-halign':      'center',
            'text-margin-y':    16,
            'shape':            'roundrectangle',
            'padding-top':      '46px',
            'padding-right':    '16px',
            'padding-bottom':   '16px',
            'padding-left':     '16px',
            'z-index':          1,
          }
        },
        {
          selector: 'node[kind="node"]:selected',
          style: { 'border-width': 3, 'border-color': '#FFD000' }
        },
        /* Server box (child of compound node) */
        {
          selector: 'node[kind="srvbox"]',
          style: {
            'background-color': '#ffffff',
            'border-width':     0,
            'shape':            'roundrectangle',
            'label':            'data(label)',
            'color':            '#1e1b4b',
            'font-size':        12,
            'font-family':      'Segoe UI, system-ui, sans-serif',
            'font-weight':      600,
            'text-valign':      'center',
            'text-halign':      'center',
            'width':            174,
            'height':           44,
            'z-index':          3,
            'events':           'yes',
          }
        },
        {
          selector: 'node[kind="srvbox"]:selected',
          style: { 'border-width': 0 }
        },
        /* Topic oval */
        {
          selector: 'node[kind="topic"]',
          style: {
            'shape':            'ellipse',
            'background-color': STYLE_TOPIC.bg,
            'border-width':     2,
            'border-color':     STYLE_TOPIC.border,
            'label':            'data(label)',
            'color':            STYLE_TOPIC.color,
            'font-size':        11,
            'font-family':      'Consolas, monospace',
            'font-weight':      700,
            'text-valign':      'center',
            'text-halign':      'center',
            'width':            150,
            'height':           46,
            'z-index':          1,
          }
        },
        {
          selector: 'node[kind="topic"]:selected',
          style: { 'border-width': 3, 'border-color': '#FFD000' }
        },
        /* Publish edge: node → topic (orange) */
        {
          selector: 'edge[edgeType="topic-pub"]',
          style: {
            'width': 1.5,
            'line-color':         '#F97316',
            'target-arrow-color': '#F97316',
            'target-arrow-shape': 'triangle',
            'curve-style':        'bezier',
            'z-index':            2,
          }
        },
        /* Subscribe edge: topic → node (green) */
        {
          selector: 'edge[edgeType="topic-sub"]',
          style: {
            'width': 1.5,
            'line-color':         '#22C55E',
            'target-arrow-color': '#22C55E',
            'target-arrow-shape': 'triangle',
            'curve-style':        'bezier',
            'z-index':            2,
          }
        },
        /* Service link: client → server (solid navy blue) */
        {
          selector: 'edge[edgeType="service-link"]',
          style: {
            'width':              2.5,
            'line-color':         '#1e40af',
            'target-arrow-color': '#3b82f6',
            'target-arrow-shape': 'triangle',
            'source-arrow-shape': 'none',
            'line-style':         'solid',
            'curve-style':        'bezier',
            'z-index':            2,
          }
        },
      ],
      layout:              { name: 'preset' },
      userZoomingEnabled:  true,
      userPanningEnabled:  true,
      boxSelectionEnabled: false,
      minZoom: 0.15, maxZoom: 3,
    });

    _bindCyEvents();
    _bindCtxMenu();
    _bindTrigger();
    _bindTooltip();
    _bindBboxDraw();
    _bindBusEvents();
  }

  /* ── Node style ──────────────────────────────── */
  function _applyNodeStyle(el, node) {
    const hasServers = (node.serviceServers || []).some(s => s.name);
    if (hasServers) {
      el.style({ 'background-color': STYLE_NODE_SERVERS.bg, 'border-color': STYLE_NODE_SERVERS.border, 'color': STYLE_NODE_SERVERS.color });
    } else {
      const s = node.configured ? STYLE_NODE_CONFIGURED : STYLE_NODE_DEFAULT;
      el.style({ 'background-color': s.bg, 'border-color': s.border, 'color': s.color });
    }
  }

  /* ── Server boxes (compound) ─────────────────── */
  function _syncServerBoxes(nodeId) {
    const node = Store.getState().nodes[nodeId];
    if (!node) return;
    const cyNode = cy.$('#' + nodeId);
    if (!cyNode.length) return;

    /* Remove old srvboxes for this node */
    cy.$(`[kind="srvbox"][nodeId="${nodeId}"]`).remove();

    const servers = (node.serviceServers || []).filter(s => s.name);

    if (!servers.length) {
      /* Restore leaf node style */
      _applyNodeStyle(cyNode, node);
      return;
    }

    /* Place srvboxes centred around node.pos so compound centroid ≈ node.pos */
    const pos = node.pos || cyNode.position();
    const n   = servers.length;
    servers.forEach((srv, i) => {
      const yOff = (i - (n - 1) / 2) * 52;
      cy.add({
        group: 'nodes',
        data: {
          id:      `srvbox__${nodeId}__${i}`,
          label:   '"' + srv.name + '"',
          kind:    'srvbox',
          parent:  nodeId,
          nodeId:  nodeId,
          srvIdx:  i,
        },
        position: { x: pos.x, y: pos.y + yOff },
        grabbable: false,
        selectable: false,
      });
    });
  }

  /* ── ··· trigger ─────────────────────────────── */
  let _hideTimer = null;

  function _showTrigger(cyNode) {
    clearTimeout(_hideTimer);
    const rp = cyNode.renderedPosition();
    const rw = cyNode.renderedWidth()  / 2;
    const rh = cyNode.renderedHeight() / 2;
    TRIGGER.style.left = (rp.x + rw - 30) + 'px';
    TRIGGER.style.top  = (rp.y - rh + 5)  + 'px';
    TRIGGER.dataset.nid  = cyNode.id();
    TRIGGER.dataset.kind = cyNode.data('kind') || 'node';
    TRIGGER.classList.remove('hidden');
  }

  function _hideTrigger(ms) {
    _hideTimer = setTimeout(() => TRIGGER.classList.add('hidden'), ms || 0);
  }

  function _bindTrigger() {
    cy.on('mouseover', 'node[kind="node"]', e => {
      if (_bboxActive) return;
      /* Only show trigger when hovering the node background, not its srvbox children */
      if (e.target.data('kind') === 'node') _showTrigger(e.target);
    });
    cy.on('mouseover', 'node[kind="topic"]', e => { if (!_bboxActive) _showTrigger(e.target); });
    cy.on('mouseover', 'node[kind="bbox"]',  e => { if (!_bboxActive) _showTrigger(e.target); });
    cy.on('mouseout',  'node[kind="node"], node[kind="topic"], node[kind="bbox"]', () => _hideTrigger(150));
    cy.on('pan zoom',  () => _hideTrigger(0));

    TRIGGER.addEventListener('mouseenter', () => clearTimeout(_hideTimer));
    TRIGGER.addEventListener('mouseleave', () => _hideTrigger(150));
    TRIGGER.addEventListener('click', e => {
      _activeNodeId = TRIGGER.dataset.nid;
      _activeKind   = TRIGGER.dataset.kind || 'node';
      _updateCtxForKind();
      const r = TRIGGER.getBoundingClientRect();
      _showCtxMenu(r.left, r.bottom + 4);
      e.stopPropagation();
    });
  }

  /* ── Context menu ────────────────────────────── */
  function _updateCtxForKind() {
    const isNode = _activeKind === 'node';
    CTX.querySelector('[data-action="edit"]')?.classList.toggle('hidden', !isNode);
    CTX.querySelector('[data-action="duplicate"]')?.classList.toggle('hidden', !isNode);
  }

  function _showCtxMenu(x, y) {
    CTX.style.left = x + 'px';
    CTX.style.top  = y + 'px';
    CTX.classList.remove('hidden');
  }

  function _hideCtxMenu() {
    CTX.classList.add('hidden');
    _activeNodeId = null;
    _activeKind   = 'node';
  }

  function _bindCtxMenu() {
    CTX.addEventListener('click', e => {
      const action = e.target.dataset.action;
      if (!action || !_activeNodeId) return;
      if (_activeKind === 'topic') {
        if (action === 'delete') Store.removeTopic(_activeNodeId);
      } else if (_activeKind === 'bbox') {
        if (action === 'delete') Store.removeBox(_activeNodeId);
      } else {
        if (action === 'delete')    Store.removeNode(_activeNodeId);
        if (action === 'duplicate') Store.duplicateNode(_activeNodeId);
        if (action === 'edit')      Bus.emit('modal:open', { nodeId: _activeNodeId });
      }
      _hideCtxMenu();
    });
    document.addEventListener('click', e => {
      if (!CTX.contains(e.target) && !TRIGGER.contains(e.target)) _hideCtxMenu();
    });
  }

  /* ── Cytoscape interactions ───────────────────── */
  function _bindCyEvents() {
    cy.on('tap', e => { if (e.target === cy) _hideCtxMenu(); });

    cy.on('tap', 'node[kind="node"]', e => {
      if (e.target.data('kind') === 'node') Bus.emit('modal:open', { nodeId: e.target.id() });
    });

    cy.on('dragend', 'node[kind="node"]', e => {
      const p = e.target.position();
      Store.updateNode(e.target.id(), { pos: { x: p.x, y: p.y } });
    });
    cy.on('dragend', 'node[kind="topic"]', e => {
      const p = e.target.position();
      Store.updateTopic(e.target.id(), { pos: { x: p.x, y: p.y } });
    });
    cy.on('dragend', 'node[kind="bbox"]', e => {
      const p = e.target.position();
      Store.updateBox(e.target.id(), { pos: { x: p.x, y: p.y } });
    });
  }

  /* ── Tooltip helpers ─────────────────────────── */
  function _showTooltip(clientX, clientY, html) {
    clearTimeout(_ttTimer);
    _ttTimer = setTimeout(() => {
      if (!TOOLTIP) return;
      TOOLTIP.innerHTML = html;
      const tx = Math.min(clientX + 14, window.innerWidth  - 320);
      const ty = Math.min(clientY + 14, window.innerHeight - 260);
      TOOLTIP.style.left = tx + 'px';
      TOOLTIP.style.top  = ty + 'px';
      TOOLTIP.classList.remove('hidden');
    }, 350);
  }

  function _hideTooltip() {
    clearTimeout(_ttTimer);
    TOOLTIP?.classList.add('hidden');
  }

  function _ttRow(key, val) {
    return `<div class="tt-row"><span class="tt-key">${key}</span><span class="tt-val">${val || '—'}</span></div>`;
  }

  function _ttVarList(vars) {
    if (!vars || !vars.length) return '<span class="tt-val">—</span>';
    return vars.map(v => `<span class="tt-val tt-var">${v.varType} ${v.varName}</span>`).join('');
  }

  function _resolveSrvLabel(ifaceId) {
    const state = Store.getState();
    const iface = state.interfaces[ifaceId];
    if (!iface) return '—';
    const pkg = state.packages[iface.package];
    return pkg ? `${pkg.name}/${iface.name}.srv` : `${iface.name}.srv`;
  }

  function _resolveIfaceData(ifaceId) {
    return Store.getState().interfaces[ifaceId] || null;
  }

  /* ── Tooltip bindings ────────────────────────── */
  function _bindTooltip() {
    /* Pub edge: node → topic */
    cy.on('mouseover', 'edge[edgeType="topic-pub"]', e => {
      if (_bboxActive) return;
      const parts = e.target.id().split('__');
      const state = Store.getState();
      const node  = state.nodes[parts[1]];
      const topic = state.topics[parts[2]];
      if (!node || !topic) return;
      const pub = (node.publishers || []).find(p => p.topic === topic.name) || {};
      const ev  = e.originalEvent;
      _showTooltip(ev.clientX, ev.clientY, `
        <div class="tt-title tt-pub-title">📤 PUBLISHER</div>
        ${_ttRow('From',    node.name)}
        ${_ttRow('Topic',   topic.name)}
        ${_ttRow('Msg Type', pub.msgType || '—')}
        ${_ttRow('Queue',   pub.queueSize)}
        ${_ttRow('QoS',     pub.qos || 'default')}
      `);
    });

    /* Sub edge: topic → node */
    cy.on('mouseover', 'edge[edgeType="topic-sub"]', e => {
      if (_bboxActive) return;
      const parts = e.target.id().split('__');
      const state = Store.getState();
      const topic = state.topics[parts[1]];
      const node  = state.nodes[parts[2]];
      if (!node || !topic) return;
      const sub = (node.subscribers || []).find(s => s.topic === topic.name) || {};
      const ev  = e.originalEvent;
      _showTooltip(ev.clientX, ev.clientY, `
        <div class="tt-title tt-sub-title">📥 SUBSCRIBER</div>
        ${_ttRow('To',       node.name)}
        ${_ttRow('Topic',    topic.name)}
        ${_ttRow('Msg Type', sub.msgType || '—')}
        ${_ttRow('Callback', sub.callbackName || '—')}
        ${_ttRow('Queue',    sub.queueSize)}
        ${_ttRow('QoS',      sub.qos || 'default')}
      `);
    });

    /* Topic oval */
    cy.on('mouseover', 'node[kind="topic"]', e => {
      if (_bboxActive) return;
      const state   = Store.getState();
      const topic   = state.topics[e.target.id()];
      if (!topic) return;
      const nodes   = Object.values(state.nodes);
      const pubNodes = nodes.filter(n => (n.publishers  || []).some(p => p.topic === topic.name));
      const subNodes = nodes.filter(n => (n.subscribers || []).some(s => s.topic === topic.name));
      const ev = e.originalEvent;
      _showTooltip(ev.clientX, ev.clientY, `
        <div class="tt-title tt-topic-title">🔵 TOPIC</div>
        ${_ttRow('Name',     topic.name)}
        ${_ttRow('Msg Type', topic.msgType || 'not set')}
        ${_ttRow('Pubs',     pubNodes.length + (pubNodes.length ? ' — ' + pubNodes.map(n=>n.name).join(', ') : ''))}
        ${_ttRow('Subs',     subNodes.length + (subNodes.length ? ' — ' + subNodes.map(n=>n.name).join(', ') : ''))}
      `);
    });

    /* Service link edge: client → server */
    cy.on('mouseover', 'edge[edgeType="service-link"]', e => {
      if (_bboxActive) return;
      const parts      = e.target.id().split('__');
      const state      = Store.getState();
      const clientNode = state.nodes[parts[1]];
      const serverNode = state.nodes[parts[2]];
      const serverName = parts[3] || e.target.data('serverName') || '—';
      if (!clientNode || !serverNode) return;

      /* Find the server entry to get .srv file and QoS */
      const srvEntry = (serverNode.serviceServers || []).find(s => s.name === serverName) || {};
      const iface    = _resolveIfaceData(srvEntry.srvFile || '');
      const srvLabel = srvEntry.srvFile ? _resolveSrvLabel(srvEntry.srvFile) : '—';

      let reqHtml  = iface ? _ttVarList(iface.request)  : '<span class="tt-val">—</span>';
      let respHtml = iface ? _ttVarList(iface.response) : '<span class="tt-val">—</span>';

      const ev = e.originalEvent;
      _showTooltip(ev.clientX, ev.clientY, `
        <div class="tt-title" style="color:#60a5fa">🔗 SERVICE LINK</div>
        ${_ttRow('Server', serverName)}
        ${_ttRow('Client', clientNode.name)}
        ${_ttRow('Host',   serverNode.name)}
        ${_ttRow('.srv',   srvLabel)}
        <div class="tt-row tt-vars-row">
          <span class="tt-key">Request</span>
          <div class="tt-val-col">${reqHtml}</div>
        </div>
        <div class="tt-row tt-vars-row">
          <span class="tt-key">Response</span>
          <div class="tt-val-col">${respHtml}</div>
        </div>
        ${_ttRow('Server QoS', srvEntry.qos || 'default')}
        ${_ttRow('Callback',   srvEntry.callbackFn || '—')}
      `);
    });

    /* Server box (srvbox inside compound node) */
    cy.on('mouseover', 'node[kind="srvbox"]', e => {
      if (_bboxActive) return;
      const nodeId = e.target.data('nodeId');
      const srvIdx = e.target.data('srvIdx');
      const state  = Store.getState();
      const node   = state.nodes[nodeId];
      if (!node) return;

      const srv      = (node.serviceServers || [])[srvIdx] || {};
      const srvLabel = srv.srvFile ? _resolveSrvLabel(srv.srvFile) : '—';
      const iface    = _resolveIfaceData(srv.srvFile || '');

      /* Count client nodes */
      const clientNodes = Object.values(state.nodes).filter(n =>
        n.id !== nodeId && (n.serviceClients || []).some(c => c.name === srv.name)
      );

      let reqHtml  = iface ? _ttVarList(iface.request)  : '<span class="tt-val">—</span>';
      let respHtml = iface ? _ttVarList(iface.response) : '<span class="tt-val">—</span>';

      const ev = e.originalEvent;
      _showTooltip(ev.clientX, ev.clientY, `
        <div class="tt-title" style="color:#a78bfa">⚡ SERVICE SERVER</div>
        ${_ttRow('Server',   srv.name || '—')}
        ${_ttRow('Host',     node.name)}
        ${_ttRow('.srv',     srvLabel)}
        <div class="tt-row tt-vars-row">
          <span class="tt-key">Request</span>
          <div class="tt-val-col">${reqHtml}</div>
        </div>
        <div class="tt-row tt-vars-row">
          <span class="tt-key">Response</span>
          <div class="tt-val-col">${respHtml}</div>
        </div>
        ${_ttRow('Callback',    srv.callbackFn || '—')}
        ${_ttRow('QoS',         srv.qos || 'default')}
        ${_ttRow('Clients',     clientNodes.length + (clientNodes.length ? ' — ' + clientNodes.map(n=>n.name).join(', ') : ''))}
      `);
    });

    cy.on('mouseout', 'edge, node', () => _hideTooltip());
    cy.on('pan zoom', () => _hideTooltip());
  }

  /* ── Edge sync ───────────────────────────────── */
  function _syncEdges() {
    const state   = Store.getState();
    const nodes   = Object.values(state.nodes);
    const topics  = Object.values(state.topics || {});
    const desired = new Map();

    nodes.forEach(node => {
      /* Pub edges */
      (node.publishers || []).forEach(pub => {
        if (!pub.topic) return;
        const topic = topics.find(t => t.name === pub.topic);
        if (!topic) return;
        const key = `pub__${node.id}__${topic.id}`;
        desired.set(key, { src: node.id, tgt: topic.id, edgeType: 'topic-pub' });
      });

      /* Sub edges */
      (node.subscribers || []).forEach(sub => {
        if (!sub.topic) return;
        const topic = topics.find(t => t.name === sub.topic);
        if (!topic) return;
        const key = `sub__${topic.id}__${node.id}`;
        desired.set(key, { src: topic.id, tgt: node.id, edgeType: 'topic-sub' });
      });

      /* Service link edges: client → server (solid navy) */
      (node.serviceClients || []).forEach(cli => {
        if (!cli.name) return;
        nodes.forEach(nodeB => {
          if (nodeB.id === node.id) return;
          (nodeB.serviceServers || []).forEach(srv => {
            if (srv.name === cli.name) {
              const key = `svclink__${node.id}__${nodeB.id}__${cli.name}`;
              desired.set(key, {
                src:        node.id,
                tgt:        nodeB.id,
                serverName: cli.name,
                srvFile:    srv.srvFile,
                edgeType:   'service-link',
              });
            }
          });
        });
      });
    });

    cy.edges().forEach(edge => { if (!desired.has(edge.id())) cy.remove(edge); });
    desired.forEach((edge, key) => {
      if (!cy.$('#' + key).length) {
        cy.add({ group: 'edges', data: { id: key, source: edge.src, target: edge.tgt, edgeType: edge.edgeType, serverName: edge.serverName || '', srvFile: edge.srvFile || '' } });
      }
    });
  }

  /* ── Bbox draw mode ──────────────────────────── */
  function _screenToCy(sx, sy) {
    const rect = document.getElementById('canvas').getBoundingClientRect();
    const pan  = cy.pan(), zoom = cy.zoom();
    return { x: ((sx - rect.left) - pan.x) / zoom, y: ((sy - rect.top) - pan.y) / zoom };
  }

  function _enterBboxMode() {
    _bboxActive = true;
    _bboxColor  = 0;
    document.getElementById('bbox-overlay').classList.add('bbox-active');
    document.querySelectorAll('.bpick-swatch').forEach((sw, i) => sw.classList.toggle('active', i === 0));
    cy.userPanningEnabled(false);
    cy.userZoomingEnabled(false);
  }

  function _exitBboxMode(clearPicker) {
    _bboxActive = false;
    _bboxGeom   = null;
    document.getElementById('bbox-overlay').classList.remove('bbox-active');
    const rubber = document.getElementById('bbox-rubber');
    rubber.classList.add('hidden');
    rubber.style.cssText = '';
    if (clearPicker !== false) document.getElementById('bbox-picker')?.classList.add('hidden');
    cy.userPanningEnabled(true);
    cy.userZoomingEnabled(true);
  }

  function _commitBbox() {
    if (!_bboxGeom) return;
    const label = (document.getElementById('bpick-label')?.value || '').trim() || 'Group';
    const col   = BBOX_COLORS[_bboxColor];
    const p1 = _screenToCy(_bboxGeom.x1, _bboxGeom.y1);
    const p2 = _screenToCy(_bboxGeom.x2, _bboxGeom.y2);
    const cx  = (p1.x + p2.x) / 2;
    const cY  = (p1.y + p2.y) / 2;
    const w   = Math.abs(p2.x - p1.x);
    const h   = Math.abs(p2.y - p1.y);
    const fontSize = Math.max(11, Math.min(22, Math.round(w / 14)));
    Store.addBox({ label, colorIdx: _bboxColor, bgColor: col.bg, borderColor: col.border, tabColor: col.tab, labelColor: col.label, pos: { x: cx, y: cY }, width: w, height: h, fontSize });
    document.getElementById('bbox-picker')?.classList.add('hidden');
    document.getElementById('bpick-label').value = '';
    _exitBboxMode(false);
  }

  function _bindBboxDraw() {
    const overlay = document.getElementById('bbox-overlay');
    const rubber  = document.getElementById('bbox-rubber');
    const picker  = document.getElementById('bbox-picker');
    let startClient = null;

    overlay.addEventListener('mousedown', e => {
      if (!_bboxActive) return;
      const rect = overlay.getBoundingClientRect();
      startClient = { x: e.clientX, y: e.clientY, rx: e.clientX - rect.left, ry: e.clientY - rect.top };
      rubber.style.left = startClient.rx + 'px';
      rubber.style.top  = startClient.ry + 'px';
      rubber.style.width  = '0px';
      rubber.style.height = '0px';
      rubber.classList.remove('hidden');
      e.preventDefault();
    });
    overlay.addEventListener('mousemove', e => {
      if (!startClient || !_bboxActive) return;
      const rect = overlay.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy_ = e.clientY - rect.top;
      rubber.style.left   = Math.min(startClient.rx, cx) + 'px';
      rubber.style.top    = Math.min(startClient.ry, cy_) + 'px';
      rubber.style.width  = Math.abs(cx - startClient.rx) + 'px';
      rubber.style.height = Math.abs(cy_ - startClient.ry) + 'px';
    });
    overlay.addEventListener('mouseup', e => {
      if (!startClient || !_bboxActive) return;
      const w = Math.abs(e.clientX - startClient.x), h = Math.abs(e.clientY - startClient.y);
      if (w < 50 || h < 30) { rubber.classList.add('hidden'); startClient = null; return; }
      _bboxGeom = { x1: startClient.x, y1: startClient.y, x2: e.clientX, y2: e.clientY };
      const px = Math.min(e.clientX - 140, window.innerWidth  - 310);
      const py = Math.min(e.clientY + 12,  window.innerHeight - 230);
      picker.style.left = Math.max(10, px) + 'px';
      picker.style.top  = Math.max(10, py) + 'px';
      picker.classList.remove('hidden');
      document.getElementById('bpick-label').value = '';
      document.getElementById('bpick-label').focus();
      startClient = null;
      e.preventDefault();
    });

    document.getElementById('bpick-ok')?.addEventListener('click', _commitBbox);
    document.getElementById('bpick-cancel')?.addEventListener('click', () => _exitBboxMode());
    document.getElementById('bpick-label')?.addEventListener('keydown', e => {
      if (e.key === 'Enter')  _commitBbox();
      if (e.key === 'Escape') _exitBboxMode();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _bboxActive) _exitBboxMode();
      /* Delete / Backspace: remove selected canvas element */
      if ((e.key === 'Delete' || e.key === 'Backspace') && !_bboxActive) {
        const active = document.activeElement;
        const inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
        if (inInput) return;
        const sel = cy.$(':selected');
        if (!sel.length) return;
        const el = sel[0];
        const kind = el.data('kind');
        const id   = el.id();
        if (kind === 'node')  Store.removeNode(id);
        else if (kind === 'topic') Store.removeTopic(id);
        else if (kind === 'bbox')  Store.removeBox(id);
      }
    });
    document.querySelectorAll('.bpick-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.bpick-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        _bboxColor = parseInt(sw.dataset.ci);
      });
    });
    Bus.on('bbox:start-draw', () => _enterBboxMode());
  }

  /* ── Bus events ──────────────────────────────── */
  function _bindBusEvents() {
    Bus.on('node:added', ({ nodeId }) => {
      const node = Store.getState().nodes[nodeId];
      if (!node) return;
      const el = cy.add({ group: 'nodes', data: { id: nodeId, label: node.name, kind: 'node' }, position: { ...node.pos } });
      _applyNodeStyle(el, node);
    });

    Bus.on('node:removed', ({ nodeId }) => {
      cy.$(`[kind="srvbox"][nodeId="${nodeId}"]`).remove();
      cy.$('#' + nodeId).remove();
      _syncEdges();
    });

    Bus.on('node:updated', ({ nodeId, patch }) => {
      const el = cy.$('#' + nodeId);
      if (!el.length) return;
      if (patch.name) el.data('label', patch.name);
      if (patch.pos)  el.position({ ...patch.pos });
      const node = Store.getState().nodes[nodeId];
      if (node) _applyNodeStyle(el, node);
      _syncServerBoxes(nodeId);
      _syncEdges();
    });

    Bus.on('topic:added', ({ topicId }) => {
      const topic = Store.getState().topics[topicId];
      if (!topic) return;
      if (!cy.$('#' + topicId).length)
        cy.add({ group: 'nodes', data: { id: topicId, label: topic.name, kind: 'topic' }, position: { ...topic.pos } });
      _syncEdges();
    });
    Bus.on('topic:removed', ({ topicId }) => {
      const el = cy.$('#' + topicId);
      if (el.length) cy.remove(el);
      _syncEdges();
    });
    Bus.on('topic:updated', ({ topicId, patch }) => {
      const el = cy.$('#' + topicId);
      if (!el.length) return;
      if (patch.name) el.data('label', patch.name);
    });

    Bus.on('box:added', ({ boxId }) => {
      const box = Store.getState().boxes[boxId];
      if (!box) return;
      cy.add({ group: 'nodes', data: { id: boxId, label: box.label, kind: 'bbox', bgColor: box.bgColor, borderColor: box.borderColor, tabColor: box.tabColor, labelColor: box.labelColor, fontSize: box.fontSize }, position: { ...box.pos }, style: { width: box.width, height: box.height } });
    });
    Bus.on('box:removed', ({ boxId }) => {
      const el = cy.$('#' + boxId);
      if (el.length) cy.remove(el);
    });

    Bus.on('project:loaded', () => {
      cy.elements().remove();
      const state = Store.getState();
      /* Bboxes first (behind) */
      Object.values(state.boxes || {}).forEach(box => {
        cy.add({ group: 'nodes', data: { id: box.id, label: box.label, kind: 'bbox', bgColor: box.bgColor, borderColor: box.borderColor, tabColor: box.tabColor, labelColor: box.labelColor, fontSize: box.fontSize }, position: { ...box.pos }, style: { width: box.width, height: box.height } });
      });
      /* Nodes */
      Object.values(state.nodes).forEach(node => {
        const el = cy.add({ group: 'nodes', data: { id: node.id, label: node.name, kind: 'node' }, position: { ...node.pos } });
        _applyNodeStyle(el, node);
        _syncServerBoxes(node.id);
      });
      /* Topics */
      Object.values(state.topics || {}).forEach(topic => {
        cy.add({ group: 'nodes', data: { id: topic.id, label: topic.name, kind: 'topic' }, position: { ...topic.pos } });
      });
      _syncEdges();
    });
  }

  function getViewportCenter() {
    if (!cy) return { x: 300, y: 200 };
    const ext = cy.extent();
    return { x: (ext.x1 + ext.x2) / 2 + (Math.random() - 0.5) * 60, y: (ext.y1 + ext.y2) / 2 + (Math.random() - 0.5) * 60 };
  }

  return { init, getViewportCenter };
})();
