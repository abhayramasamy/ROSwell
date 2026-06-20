/* js/ui/modal/tab_processes.js — PROCESSES tab */
window.TabProcesses = (() => {
  function _fnRow(fn) {
    return `<div class="fn-row">
      <span class="fn-drag-handle" title="Drag to reorder">⠿</span>
      <input class="fn-name" placeholder="function_name()" value="${fn || ''}">
      <button class="fn-del" title="Remove">×</button>
    </div>`;
  }

  function _timerRow(timer, cbgNames) {
    const cbgOpts = cbgNames.length
      ? cbgNames.map(n => `<option value="${n}" ${timer.callbackGroup === n ? 'selected' : ''}>${n}</option>`).join('')
      : '<option value="">none</option>';

    const fnRows = (timer.callableSequence || []).map(_fnRow).join('');

    return `<div class="timer-block" data-tid="${timer.id || ''}">
      <div class="timer-main-row">
        <input class="tmr-name"   placeholder="timer_name"   value="${timer.name || ''}">
        <input class="tmr-period" placeholder="period (ms)"  value="${timer.periodMs || ''}" type="number" min="1" style="width:110px;flex:none">
        <select class="tmr-cbg" title="Callback Group">${cbgOpts}</select>
        <button class="tmr-toggle" title="Toggle callable sequence">▾ Seq</button>
        <button class="row-del" title="Remove timer">×</button>
      </div>
      <div class="timer-seq hidden">
        <div class="timer-seq-hdr">
          Callable Sequence
          <button class="add-fn-btn">+ Add Function</button>
        </div>
        <div class="fn-rows">${fnRows}</div>
      </div>
    </div>`;
  }

  function render(draft) {
    const spinOpts = ROS2Schema.SPIN_MODES.map(m =>
      `<option value="${m}" ${draft.spinMode === m ? 'selected' : ''}>${m}()</option>`
    ).join('');

    const cbgNames = (draft.threading?.callbackGroups || []).map(c => c.name).filter(Boolean);
    const timerBlocks = (draft.timers || []).map(t => _timerRow(t, cbgNames)).join('');

    return `
      <div class="modal-form">
        <div class="form-row">
          <label>Spin mode</label>
          <select id="pr-spin">${spinOpts}</select>
        </div>
        <div class="form-row">
          <label>Lifecycle node</label>
          <label class="toggle-wrap">
            <input id="pr-lifecycle" type="checkbox" ${draft.lifecycle ? 'checked' : ''}>
            <span class="toggle-label">Generates on_configure / on_activate / on_deactivate stubs</span>
          </label>
        </div>

        <div class="section-hdr" style="margin-top:20px">
          Timers <button class="add-row-btn" id="add-timer">+ Add Timer</button>
        </div>
        <div id="timer-rows">${timerBlocks || '<div class="comms-empty">No timers — click + Add Timer</div>'}</div>
      </div>
    `;
  }

  function _bindTimerBlock(block) {
    /* Delete timer */
    block.querySelector('.row-del').addEventListener('click', () => block.remove());

    /* Toggle callable sequence */
    const seqEl   = block.querySelector('.timer-seq');
    const toggleBtn = block.querySelector('.tmr-toggle');
    toggleBtn.addEventListener('click', () => {
      const hidden = seqEl.classList.toggle('hidden');
      toggleBtn.textContent = hidden ? '▾ Seq' : '▴ Seq';
    });

    /* Bind existing fn rows */
    block.querySelectorAll('.fn-row').forEach(row => _bindFnRow(row));

    /* Add function button */
    block.querySelector('.add-fn-btn').addEventListener('click', () => {
      const fnRowsEl = block.querySelector('.fn-rows');
      const div = document.createElement('div');
      div.innerHTML = _fnRow('');
      const row = div.firstElementChild;
      fnRowsEl.appendChild(row);
      _bindFnRow(row);
      row.querySelector('.fn-name')?.focus();
    });
  }

  function _bindFnRow(row) {
    row.querySelector('.fn-del').addEventListener('click', () => row.remove());
  }

  function bind(draft) {
    document.querySelectorAll('#timer-rows .timer-block').forEach(_bindTimerBlock);

    const cbgNames = (draft.threading?.callbackGroups || []).map(c => c.name).filter(Boolean);

    document.getElementById('add-timer').addEventListener('click', () => {
      const container = document.getElementById('timer-rows');
      const empty = container.querySelector('.comms-empty');
      if (empty) empty.remove();
      const div = document.createElement('div');
      div.innerHTML = _timerRow({ name: '', periodMs: '', callbackGroup: '', callableSequence: [] }, cbgNames);
      const block = div.firstElementChild;
      container.appendChild(block);
      _bindTimerBlock(block);
    });
  }

  function collect() {
    const timers = [];
    document.querySelectorAll('#timer-rows .timer-block').forEach(block => {
      const callableSequence = [];
      block.querySelectorAll('.fn-row .fn-name').forEach(inp => {
        const val = inp.value.trim();
        if (val) callableSequence.push(val);
      });
      timers.push({
        name:             block.querySelector('.tmr-name')?.value.trim()  || '',
        periodMs:         parseInt(block.querySelector('.tmr-period')?.value) || 0,
        callbackGroup:    block.querySelector('.tmr-cbg')?.value          || '',
        callableSequence,
      });
    });

    return {
      spinMode:  document.getElementById('pr-spin')?.value     || 'spin',
      lifecycle: document.getElementById('pr-lifecycle')?.checked || false,
      timers,
    };
  }

  return { render, bind, collect };
})();
