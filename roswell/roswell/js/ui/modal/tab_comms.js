/* js/ui/modal/tab_comms.js — COMMUNICATION tab */
window.TabComms = (() => {
  function _qosOpts(selected) {
    return ROS2Schema.QOS_PROFILES.map(q =>
      `<option value="${q}" ${selected === q ? 'selected' : ''}>${q}</option>`
    ).join('');
  }

  function _pubRow(row) {
    row = row || {};
    return `<div class="list-row comms-row">
      <div class="comms-row-main">
        <span class="row-badge pub-badge">PUB</span>
        <input  class="row-topic"   placeholder="/topic_name"  value="${row.topic || ''}">
        <input  class="row-msgtype" placeholder="std_msgs/String" value="${row.msgType || ''}">
        <input  class="row-qsize"   placeholder="QSize" type="number" min="1" value="${row.queueSize || 10}" style="width:70px;flex:none">
        <select class="row-qos" title="QoS Profile">${_qosOpts(row.qos || 'default')}</select>
        <button class="row-del" title="Remove">×</button>
      </div>
    </div>`;
  }

  function _subRow(row) {
    row = row || {};
    return `<div class="list-row comms-row">
      <div class="comms-row-main">
        <span class="row-badge sub-badge">SUB</span>
        <input  class="row-topic"   placeholder="/topic_name"   value="${row.topic || ''}">
        <input  class="row-msgtype" placeholder="std_msgs/String"  value="${row.msgType || ''}">
        <input  class="row-cb"      placeholder="callback_name"  value="${row.callbackName || ''}">
        <input  class="row-qsize"   placeholder="QSize" type="number" min="1" value="${row.queueSize || 10}" style="width:70px;flex:none">
        <select class="row-qos" title="QoS Profile">${_qosOpts(row.qos || 'default')}</select>
        <button class="row-del" title="Remove">×</button>
      </div>
    </div>`;
  }

  function render(draft) {
    const pubs = (draft.publishers  || []).map(_pubRow).join('');
    const subs = (draft.subscribers || []).map(_subRow).join('');
    return `
      <div class="modal-form">
        <div class="comms-legend">
          <span class="legend-item"><span class="row-badge pub-badge">PUB</span> Publisher</span>
          <span class="legend-item"><span class="row-badge sub-badge">SUB</span> Subscriber</span>
          <span class="legend-hint">Fields: topic · msg type · callback (sub) · queue size · QoS</span>
        </div>

        <div class="section-hdr">Publishers <button class="add-row-btn" id="add-pub">+ Add</button></div>
        <div id="pub-rows">${pubs || '<div class="comms-empty">No publishers — click + Add</div>'}</div>

        <div class="section-hdr" style="margin-top:24px">Subscribers <button class="add-row-btn" id="add-sub">+ Add</button></div>
        <div id="sub-rows">${subs || '<div class="comms-empty">No subscribers — click + Add</div>'}</div>
      </div>
    `;
  }

  function _bindDel(rowEl) {
    rowEl.querySelector('.row-del').addEventListener('click', () => rowEl.remove());
  }

  function _appendRow(containerId, html) {
    const container = document.getElementById(containerId);
    const empty = container.querySelector('.comms-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.innerHTML = html;
    const row = div.firstElementChild;
    container.appendChild(row);
    _bindDel(row);
    row.querySelector('.row-topic')?.focus();
  }

  function bind() {
    document.querySelectorAll('#pub-rows .list-row, #sub-rows .list-row').forEach(_bindDel);

    document.getElementById('add-pub').addEventListener('click', () => {
      _appendRow('pub-rows', _pubRow({}));
    });

    document.getElementById('add-sub').addEventListener('click', () => {
      _appendRow('sub-rows', _subRow({}));
    });
  }

  function collect() {
    const publishers = [];
    document.querySelectorAll('#pub-rows .list-row').forEach(row => {
      publishers.push({
        topic:     (row.querySelector('.row-topic')?.value   || '').trim(),
        msgType:   (row.querySelector('.row-msgtype')?.value || '').trim(),
        queueSize: parseInt(row.querySelector('.row-qsize')?.value  || 10),
        qos:       row.querySelector('.row-qos')?.value     || 'default',
      });
    });

    const subscribers = [];
    document.querySelectorAll('#sub-rows .list-row').forEach(row => {
      subscribers.push({
        topic:        (row.querySelector('.row-topic')?.value   || '').trim(),
        msgType:      (row.querySelector('.row-msgtype')?.value || '').trim(),
        callbackName: (row.querySelector('.row-cb')?.value      || '').trim(),
        queueSize:    parseInt(row.querySelector('.row-qsize')?.value   || 10),
        qos:          row.querySelector('.row-qos')?.value      || 'default',
      });
    });

    return { publishers, subscribers };
  }

  return { render, bind, collect };
})();
