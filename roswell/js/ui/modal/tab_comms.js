/* js/ui/modal/tab_comms.js — COMMUNICATION tab */
window.TabComms = (() => {
  let _topicHandler  = null;
  let _qosHandler    = null;

  /* ── Dynamic QoS select ──────────────────────── */
  function _qosSelectHtml(selectedId) {
    const sel      = selectedId || 'default';
    const builtin  = ROS2Schema.BUILTIN_QOS;
    const customs  = Object.values(Store.getState().qosProfiles || {});

    const builtinOpts = Object.entries(builtin).map(([id, p]) => {
      const short = `${p.reliability === 'RELIABLE' ? 'REL' : 'BE'}, ${p.durability === 'TRANSIENT_LOCAL' ? 'TL' : 'VOL'}, D${p.depth}`;
      return `<option value="${id}" ${sel === id ? 'selected' : ''}>${p.label} (${short})</option>`;
    }).join('');

    const customOpts = customs.length
      ? `<optgroup label="── Custom ──">${customs.map(p =>
          `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${p.name}</option>`
        ).join('')}</optgroup>`
      : '';

    return `<select class="row-qos" title="QoS Profile">${builtinOpts}${customOpts}</select>`;
  }

  function _refreshQosSelects() {
    document.querySelectorAll('.row-qos').forEach(sel => {
      const current = sel.value;
      const wrap = document.createElement('div');
      wrap.innerHTML = _qosSelectHtml(current);
      sel.replaceWith(wrap.firstElementChild);
    });
  }

  /* ── Row templates ───────────────────────────── */
  function _pubRow(row) {
    row = row || {};
    return `<div class="list-row comms-row">
      <div class="comms-row-main">
        <span class="row-badge pub-badge">PUB</span>
        <input class="row-topic"   list="tc-topic-list" placeholder="/topic_name" value="${row.topic || ''}" autocomplete="off" spellcheck="false">
        <input class="row-msgtype" list="tc-msg-list" placeholder="std_msgs/String" value="${row.msgType || ''}" autocomplete="off" spellcheck="false">
        <input class="row-qsize"   type="number" min="1" value="${row.queueSize || 10}" style="width:64px;flex:none" title="Queue size">
        ${_qosSelectHtml(row.qos || 'default')}
        <button class="row-del" title="Remove">×</button>
      </div>
    </div>`;
  }

  function _subRow(row) {
    row = row || {};
    return `<div class="list-row comms-row">
      <div class="comms-row-main">
        <span class="row-badge sub-badge">SUB</span>
        <input class="row-topic"   list="tc-topic-list" placeholder="/topic_name" value="${row.topic || ''}" autocomplete="off" spellcheck="false">
        <input class="row-msgtype" placeholder="std_msgs/String" value="${row.msgType || ''}">
        <input class="row-cb"      placeholder="callback_name" value="${row.callbackName || ''}">
        <input class="row-qsize"   type="number" min="1" value="${row.queueSize || 10}" style="width:64px;flex:none" title="Queue size">
        ${_qosSelectHtml(row.qos || 'default')}
        <button class="row-del" title="Remove">×</button>
      </div>
    </div>`;
  }

  /* ── Datalists ───────────────────────────────── */
  const _BUILTIN_MSG_TYPES = [
    'std_msgs/String','std_msgs/Bool','std_msgs/Int32','std_msgs/Float32',
    'std_msgs/Float64','std_msgs/UInt8','std_msgs/UInt16','std_msgs/UInt32',
    'std_msgs/UInt64','std_msgs/Int8','std_msgs/Int16','std_msgs/Int64',
    'geometry_msgs/Point','geometry_msgs/Quaternion','geometry_msgs/Pose',
    'geometry_msgs/Twist','geometry_msgs/Vector3',
    'sensor_msgs/Image','sensor_msgs/LaserScan','sensor_msgs/Imu',
    'nav_msgs/Odometry','nav_msgs/Path',
    'std_msgs/Header','std_msgs/ColorRGBA','std_msgs/ByteMultiArray',
  ];

  function _datalist() {
    return `
      <datalist id="tc-topic-list"></datalist>
      <datalist id="tc-msg-list"></datalist>
    `;
  }

  function _refreshDatalist() {
    const dlTopic = document.getElementById('tc-topic-list');
    if (dlTopic) {
      dlTopic.innerHTML = Object.values(Store.getState().topics || {})
        .map(t => `<option value="${t.name}">`).join('');
    }
    const dlMsg = document.getElementById('tc-msg-list');
    if (dlMsg) {
      const custom = Object.values(Store.getState().interfaces || {})
        .filter(i => i.type === 'msg')
        .map(i => {
          const pkg = Store.getState().packages[i.package];
          return pkg ? `${pkg.name}/${i.name}` : '';
        }).filter(Boolean);
      const all = [..._BUILTIN_MSG_TYPES, ...custom];
      dlMsg.innerHTML = all.map(m => `<option value="${m}">`).join('');
    }
  }

  /* ── Render ──────────────────────────────────── */
  function render(draft) {
    const pubs = (draft.publishers  || []).map(_pubRow).join('');
    const subs = (draft.subscribers || []).map(_subRow).join('');
    return `
      <div class="modal-form">
        ${_datalist()}
        <div class="comms-legend">
          <span class="legend-item"><span class="row-badge pub-badge">PUB</span> node → topic oval</span>
          <span class="legend-item"><span class="row-badge sub-badge">SUB</span> topic oval → node</span>
          <span class="legend-hint">One topic = one msg type. QoS profiles are per-publisher/subscriber.</span>
        </div>

        <div class="section-hdr">Publishers
          <button class="add-row-btn" id="add-pub">+ Add</button>
          <button class="qos-shortcut-btn" id="open-qos-modal">⚙ Manage QoS Profiles</button>
        </div>
        <div id="pub-rows">${pubs || '<div class="comms-empty">No publishers — click + Add</div>'}</div>

        <div class="section-hdr" style="margin-top:24px">Subscribers
          <button class="add-row-btn" id="add-sub">+ Add</button>
        </div>
        <div id="sub-rows">${subs || '<div class="comms-empty">No subscribers — click + Add</div>'}</div>
      </div>
    `;
  }

  /* ── Topic auto-fill and lock ────────────────── */
  function _bindTopicRow(rowEl) {
    const topicInput   = rowEl.querySelector('.row-topic');
    const msgTypeInput = rowEl.querySelector('.row-msgtype');
    if (!topicInput || !msgTypeInput) return;

    rowEl.querySelector('.row-del')?.addEventListener('click', () => rowEl.remove());

    topicInput.addEventListener('input', () => {
      const v = topicInput.value;
      if (v && !v.startsWith('/')) topicInput.value = '/' + v;
    });

    function _checkAndLock() {
      const raw = topicInput.value.trim();
      if (!raw || raw === '/') {
        msgTypeInput.readOnly = false;
        msgTypeInput.classList.remove('field-locked');
        msgTypeInput.title = '';
        return;
      }
      const norm     = raw.startsWith('/') ? raw : '/' + raw;
      const existing = Object.values(Store.getState().topics || {}).find(t => t.name === norm);
      if (existing && existing.msgType) {
        msgTypeInput.value    = existing.msgType;
        msgTypeInput.readOnly = true;
        msgTypeInput.title    = `Locked — ${norm} already uses ${existing.msgType}`;
        msgTypeInput.classList.add('field-locked');
      } else {
        msgTypeInput.readOnly = false;
        msgTypeInput.title    = '';
        msgTypeInput.classList.remove('field-locked');
      }
    }

    topicInput.addEventListener('change', _checkAndLock);
    topicInput.addEventListener('blur',   _checkAndLock);
    if (topicInput.value) _checkAndLock();
  }

  function _appendRow(containerId, html) {
    const container = document.getElementById(containerId);
    const empty     = container.querySelector('.comms-empty');
    if (empty) empty.remove();
    const div       = document.createElement('div');
    div.innerHTML   = html;
    const row       = div.firstElementChild;
    container.appendChild(row);
    _bindTopicRow(row);
    row.querySelector('.row-topic')?.focus();
    _refreshDatalist();
  }

  /* ── Bind ────────────────────────────────────── */
  function bind() {
    document.querySelectorAll('#pub-rows .list-row, #sub-rows .list-row').forEach(_bindTopicRow);

    document.getElementById('add-pub')?.addEventListener('click', () => _appendRow('pub-rows', _pubRow({})));
    document.getElementById('add-sub')?.addEventListener('click', () => _appendRow('sub-rows', _subRow({})));
    document.getElementById('open-qos-modal')?.addEventListener('click', () => Bus.emit('qos-modal:open', {}));

    _refreshDatalist();

    if (_topicHandler) Bus.off('topic:added', _topicHandler);
    _topicHandler = () => _refreshDatalist();
    Bus.on('topic:added', _topicHandler);

    if (_qosHandler) { Bus.off('qos-profile:added', _qosHandler); Bus.off('qos-profile:updated', _qosHandler); Bus.off('qos-profile:removed', _qosHandler); }
    _qosHandler = () => _refreshQosSelects();
    Bus.on('qos-profile:added',   _qosHandler);
    Bus.on('qos-profile:updated', _qosHandler);
    Bus.on('qos-profile:removed', _qosHandler);
  }

  /* ── Validate msgType consistency ────────────── */
  function validate(publishers, subscribers) {
    const errors = [];
    const topics = Object.values(Store.getState().topics || {});
    const check  = (entry, dir) => {
      if (!entry.topic || !entry.msgType) return;
      const topic = topics.find(t => t.name === entry.topic);
      if (topic && topic.msgType && topic.msgType !== entry.msgType) {
        errors.push(`${dir} "${entry.topic}" expects type "${topic.msgType}" but "${entry.msgType}" was entered.`);
      }
    };
    publishers.forEach(p  => check(p,  'Publisher'));
    subscribers.forEach(s => check(s, 'Subscriber'));
    return errors;
  }

  /* ── QoS cross-node compatibility check ──────── */
  function checkQosCompatibility(publishers, subscribers, editingNodeId) {
    const state    = Store.getState();
    const allNodes = Object.values(state.nodes);
    const warnings = [];
    const seen     = new Set();

    const addWarn = (w) => { if (!seen.has(w)) { seen.add(w); warnings.push(w); } };

    /* This node's pubs vs other nodes' subs */
    publishers.forEach(pub => {
      if (!pub.topic) return;
      const pubQos = ROS2Schema.resolveQos(pub.qos || 'default');
      allNodes.forEach(node => {
        if (node.id === editingNodeId) return;
        (node.subscribers || []).forEach(sub => {
          if (sub.topic !== pub.topic) return;
          const subQos = ROS2Schema.resolveQos(sub.qos || 'default');
          ROS2Schema.qosCompatibilityWarnings(pubQos, subQos).forEach(w =>
            addWarn(`Topic "${pub.topic}" → ${node.name}: ${w}`)
          );
        });
      });
    });

    /* This node's subs vs other nodes' pubs */
    subscribers.forEach(sub => {
      if (!sub.topic) return;
      const subQos = ROS2Schema.resolveQos(sub.qos || 'default');
      allNodes.forEach(node => {
        if (node.id === editingNodeId) return;
        (node.publishers || []).forEach(pub => {
          if (pub.topic !== sub.topic) return;
          const pubQos = ROS2Schema.resolveQos(pub.qos || 'default');
          ROS2Schema.qosCompatibilityWarnings(pubQos, subQos).forEach(w =>
            addWarn(`Topic "${sub.topic}" ← ${node.name}: ${w}`)
          );
        });
      });
    });

    return warnings;
  }

  /* ── Collect ─────────────────────────────────── */
  function collect() {
    const pos = Canvas.getViewportCenter();

    const publishers = [];
    document.querySelectorAll('#pub-rows .list-row').forEach(row => {
      const topic   = (row.querySelector('.row-topic')?.value   || '').trim();
      const msgType = (row.querySelector('.row-msgtype')?.value || '').trim();
      if (topic) {
        const topicId = Store.findOrCreateTopic(topic, pos);
        if (topicId && msgType) {
          const t = Store.getState().topics[topicId];
          if (t && !t.msgType) Store.updateTopic(topicId, { msgType });
        }
      }
      publishers.push({
        topic,
        msgType,
        queueSize: Math.max(1, parseInt(row.querySelector('.row-qsize')?.value || 10)),
        qos:       row.querySelector('.row-qos')?.value || 'default',
      });
    });

    const subscribers = [];
    document.querySelectorAll('#sub-rows .list-row').forEach(row => {
      const topic   = (row.querySelector('.row-topic')?.value   || '').trim();
      const msgType = (row.querySelector('.row-msgtype')?.value || '').trim();
      if (topic) {
        const topicId = Store.findOrCreateTopic(topic, pos);
        if (topicId && msgType) {
          const t = Store.getState().topics[topicId];
          if (t && !t.msgType) Store.updateTopic(topicId, { msgType });
        }
      }
      subscribers.push({
        topic,
        msgType,
        callbackName: (row.querySelector('.row-cb')?.value || '').trim(),
        queueSize:    Math.max(1, parseInt(row.querySelector('.row-qsize')?.value || 10)),
        qos:          row.querySelector('.row-qos')?.value || 'default',
      });
    });

    if (_topicHandler) { Bus.off('topic:added', _topicHandler); _topicHandler = null; }
    if (_qosHandler)   { Bus.off('qos-profile:added', _qosHandler); Bus.off('qos-profile:updated', _qosHandler); Bus.off('qos-profile:removed', _qosHandler); _qosHandler = null; }

    return { publishers, subscribers };
  }

  return { render, bind, collect, validate, checkQosCompatibility };
})();
