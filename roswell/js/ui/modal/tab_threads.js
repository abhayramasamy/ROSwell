/* js/ui/modal/tab_threads.js — THREADS tab */
window.TabThreads = (() => {
  function _cbgRow(cbg) {
    const types = ROS2Schema.CBG_TYPES.map(t => `<option value="${t}" ${cbg.type===t?'selected':''}>${t}</option>`).join('');
    return `<div class="list-row">
      <input class="cbg-name" placeholder="group_name" value="${cbg.name||''}">
      <select class="cbg-type">${types}</select>
      <button class="row-del">×</button>
    </div>`;
  }

  function render(draft) {
    const th  = draft.threading || {};
    const model = th.model || 'single';
    const execOpts = ROS2Schema.EXEC_MODELS.map(e =>
      `<option value="${e.value}" ${model===e.value?'selected':''}>${e.label}</option>`
    ).join('');

    const cbgRows = (th.callbackGroups || []).map(_cbgRow).join('');

    return `
      <div class="modal-form">
        <div class="form-row">
          <label>Executor</label>
          <select id="th-model">${execOpts}</select>
        </div>
        <div class="form-row" id="th-num-row" style="${model==='multi'?'':'display:none'}">
          <label>Thread count</label>
          <input id="th-num" type="number" min="2" max="32" value="${th.numThreads||2}" style="width:80px">
        </div>
        <div class="section-hdr" style="margin-top:20px">
          Callback Groups <button class="add-row-btn" id="add-cbg">+ Add</button>
        </div>
        <div id="cbg-rows">${cbgRows}</div>
      </div>
    `;
  }

  function _bindDel(rowEl) {
    rowEl.querySelector('.row-del').addEventListener('click', () => rowEl.remove());
  }

  function bind() {
    document.getElementById('th-model').addEventListener('change', e => {
      const row = document.getElementById('th-num-row');
      row.style.display = e.target.value === 'multi' ? '' : 'none';
    });

    document.querySelectorAll('#cbg-rows .list-row').forEach(_bindDel);

    document.getElementById('add-cbg').addEventListener('click', () => {
      const div = document.createElement('div');
      div.innerHTML = _cbgRow({ name: '', type: 'MutuallyExclusive' });
      const row = div.firstElementChild;
      document.getElementById('cbg-rows').appendChild(row);
      _bindDel(row);
    });
  }

  function collect() {
    const callbackGroups = [];
    document.querySelectorAll('#cbg-rows .list-row').forEach(row => {
      callbackGroups.push({
        name: row.querySelector('.cbg-name').value.trim(),
        type: row.querySelector('.cbg-type').value,
      });
    });
    return {
      threading: {
        model:          document.getElementById('th-model')?.value || 'single',
        numThreads:     parseInt(document.getElementById('th-num')?.value || 2),
        callbackGroups,
      }
    };
  }

  return { render, bind, collect };
})();
