/* js/ui/canvas.js — Cytoscape canvas */
window.Canvas = (() => {
  let cy;
  let _activeNodeId = null;

  const CTX     = document.getElementById('ctx-menu');
  const TRIGGER = document.getElementById('node-menu-trigger');

  const STYLE_DEFAULT    = { bg: '#D95F5F', border: '#B84444', color: '#ffffff' };
  const STYLE_CONFIGURED = { bg: '#000000', border: '#0ef09d', color: '#0ef09d' };

  function init() {
    cy = cytoscape({
      container: document.getElementById('canvas'),
      elements:  [],
      style: [
        {
          selector: 'node[kind="node"]',
          style: {
            'shape':            'roundrectangle',
            'background-color': STYLE_DEFAULT.bg,
            'border-width':     2,
            'border-color':     STYLE_DEFAULT.border,
            'label':            'data(label)',
            'color':            STYLE_DEFAULT.color,
            'font-size':        13,
            'font-family':      'Segoe UI, system-ui, sans-serif',
            'font-weight':      600,
            'text-valign':      'center',
            'text-halign':      'center',
            'width':            150,
            'height':           65,
            'cursor':           'pointer',
          }
        },
        {
          selector: 'node:selected',
          style: { 'border-width': 3, 'border-color': '#FFD000' }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#0ef09d',
            'target-arrow-color': '#0ef09d',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': 10,
            'color': '#0ef09d',
            'text-background-color': '#1a1a1a',
            'text-background-opacity': 1,
            'text-background-padding': '2px',
          }
        },
        {
          selector: 'edge[edgeType="service"]',
          style: {
            'line-color': '#FFD000',
            'target-arrow-color': '#FFD000',
            'line-style': 'dashed',
            'color': '#FFD000',
          }
        }
      ],
      layout: { name: 'preset' },
      userZoomingEnabled:  true,
      userPanningEnabled:  true,
      boxSelectionEnabled: false,
      minZoom: 0.2, maxZoom: 3,
    });

    _bindCyEvents();
    _bindCtxMenu();
    _bindTrigger();
    _bindBusEvents();
  }

  /* ── Node style ──────────────────────────────────── */
  function _applyNodeStyle(el, node) {
    const s = node.configured ? STYLE_CONFIGURED : STYLE_DEFAULT;
    el.style({ 'background-color': s.bg, 'border-color': s.border, 'color': s.color });
  }

  /* ── ··· trigger ─────────────────────────────────── */
  let _hideTimer = null;

  function _showTrigger(node) {
    clearTimeout(_hideTimer);
    const rp = node.renderedPosition();
    const rw = node.renderedWidth()  / 2;
    const rh = node.renderedHeight() / 2;
    TRIGGER.style.left = (rp.x + rw - 30) + 'px';
    TRIGGER.style.top  = (rp.y - rh + 5)  + 'px';
    TRIGGER.dataset.nid = node.id();
    TRIGGER.classList.remove('hidden');
  }

  function _hideTrigger(ms) {
    _hideTimer = setTimeout(() => TRIGGER.classList.add('hidden'), ms || 0);
  }

  function _bindTrigger() {
    cy.on('mouseover', 'node[kind="node"]', e => _showTrigger(e.target));
    cy.on('mouseout',  'node[kind="node"]', () => _hideTrigger(150));
    cy.on('pan zoom',  () => _hideTrigger(0));

    TRIGGER.addEventListener('mouseenter', () => clearTimeout(_hideTimer));
    TRIGGER.addEventListener('mouseleave', () => _hideTrigger(150));
    TRIGGER.addEventListener('click', e => {
      _activeNodeId = TRIGGER.dataset.nid;
      const r = TRIGGER.getBoundingClientRect();
      _showCtxMenu(r.left, r.bottom + 4);
      e.stopPropagation();
    });
  }

  /* ── Context menu ────────────────────────────────── */
  function _showCtxMenu(x, y) {
    CTX.style.left = x + 'px';
    CTX.style.top  = y + 'px';
    CTX.classList.remove('hidden');
  }

  function _hideCtxMenu() {
    CTX.classList.add('hidden');
    _activeNodeId = null;
  }

  function _bindCtxMenu() {
    CTX.addEventListener('click', e => {
      const action = e.target.dataset.action;
      if (!action || !_activeNodeId) return;
      if (action === 'delete')    Store.removeNode(_activeNodeId);
      if (action === 'duplicate') Store.duplicateNode(_activeNodeId);
      if (action === 'edit')      Bus.emit('modal:open', { nodeId: _activeNodeId });
      _hideCtxMenu();
    });
    document.addEventListener('click', e => {
      if (!CTX.contains(e.target) && !TRIGGER.contains(e.target)) _hideCtxMenu();
    });
  }

  function _bindCyEvents() {
    cy.on('tap', e => { if (e.target === cy) _hideCtxMenu(); });
    cy.on('tap', 'node[kind="node"]', e => {
      Bus.emit('modal:open', { nodeId: e.target.id() });
    });
    cy.on('dragend', 'node[kind="node"]', e => {
      const p = e.target.position();
      Store.updateNode(e.target.id(), { pos: { x: p.x, y: p.y } });
    });
  }

  /* ── Auto-edge sync ──────────────────────────────── */
  function _syncEdges() {
    const state = Store.getState();
    const nodes = Object.values(state.nodes);
    const desired = new Map();

    nodes.forEach(nodeA => {
      (nodeA.publishers || []).forEach(pub => {
        if (!pub.topic) return;
        nodes.forEach(nodeB => {
          if (nodeB.id === nodeA.id) return;
          (nodeB.subscribers || []).forEach(sub => {
            if (sub.topic && sub.topic === pub.topic) {
              const key = `t__${nodeA.id}__${nodeB.id}__${pub.topic}`;
              desired.set(key, { src: nodeA.id, tgt: nodeB.id, label: pub.topic, edgeType: 'topic' });
            }
          });
        });
      });

      (nodeA.serviceServers || []).forEach(srv => {
        if (!srv.name) return;
        nodes.forEach(nodeB => {
          if (nodeB.id === nodeA.id) return;
          (nodeB.serviceClients || []).forEach(cli => {
            if (cli.name && cli.name === srv.name) {
              const key = `s__${nodeA.id}__${nodeB.id}__${srv.name}`;
              desired.set(key, { src: nodeA.id, tgt: nodeB.id, label: srv.name, edgeType: 'service' });
            }
          });
        });
      });
    });

    /* Remove edges no longer desired */
    cy.edges().forEach(edge => {
      if (!desired.has(edge.id())) cy.remove(edge);
    });

    /* Add newly desired edges */
    desired.forEach((edge, key) => {
      if (!cy.$('#' + key).length) {
        cy.add({
          group: 'edges',
          data: { id: key, source: edge.src, target: edge.tgt, label: edge.label, edgeType: edge.edgeType }
        });
      }
    });
  }

  /* ── Bus events ──────────────────────────────────── */
  function _bindBusEvents() {
    Bus.on('node:added', ({ nodeId }) => {
      const node = Store.getState().nodes[nodeId];
      if (!node) return;
      const el = cy.add({ group: 'nodes', data: { id: nodeId, label: node.name, kind: 'node' }, position: { ...node.pos } });
      _applyNodeStyle(el, node);
    });

    Bus.on('node:removed', ({ nodeId }) => {
      const el = cy.$('#' + nodeId);
      if (el.length) cy.remove(el);
      _syncEdges();
    });

    Bus.on('node:updated', ({ nodeId, patch }) => {
      const el = cy.$('#' + nodeId);
      if (!el.length) return;
      if (patch.name) el.data('label', patch.name);
      if (patch.pos)  el.position({ ...patch.pos });
      const node = Store.getState().nodes[nodeId];
      if (node) _applyNodeStyle(el, node);
      _syncEdges();
    });

    Bus.on('project:loaded', () => {
      cy.elements().remove();
      const state = Store.getState();
      Object.values(state.nodes).forEach(node => {
        const el = cy.add({ group: 'nodes', data: { id: node.id, label: node.name, kind: 'node' }, position: { ...node.pos } });
        _applyNodeStyle(el, node);
      });
      _syncEdges();
    });
  }

  function getViewportCenter() {
    if (!cy) return { x: 300, y: 200 };
    const ext = cy.extent();
    return {
      x: (ext.x1 + ext.x2) / 2 + (Math.random() - 0.5) * 60,
      y: (ext.y1 + ext.y2) / 2 + (Math.random() - 0.5) * 60
    };
  }

  return { init, getViewportCenter };
})();
