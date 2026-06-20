/* js/ui/modal/modal_topic.js — Insert Topic modal */
window.ModalTopic = (() => {

  function init() {
    document.getElementById('topic-modal-root').innerHTML = `
      <div id="topic-modal-overlay" class="hidden">
        <div id="topic-modal">
          <div id="topic-modal-header">
            <span id="topic-modal-title">Insert Topic</span>
            <button id="topic-modal-close">✕</button>
          </div>
          <div id="topic-modal-body">
            <div class="form-row">
              <label>Topic name <span class="req">*</span></label>
              <input id="tm-name" type="text" placeholder="/topic_name" autocomplete="off" spellcheck="false">
            </div>
            <div id="tm-hint" class="field-hint">
              Start with <b>/</b> e.g. <b>/cmd_vel</b>, <b>/scan</b>, <b>/joint_states</b>.
              Topic will be added as an oval on the canvas.
            </div>
          </div>
          <div id="topic-modal-footer">
            <div id="topic-modal-error"></div>
            <button id="topic-modal-cancel">Cancel</button>
            <button id="topic-modal-save">Insert Topic</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('topic-modal-close').addEventListener('click', _close);
    document.getElementById('topic-modal-cancel').addEventListener('click', _close);
    document.getElementById('topic-modal-save').addEventListener('click', _save);

    document.getElementById('topic-modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('topic-modal-overlay')) _close();
    });

    document.getElementById('tm-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') _save();
      if (e.key === 'Escape') _close();
    });

    /* Auto-prepend slash */
    document.getElementById('tm-name').addEventListener('input', e => {
      const v = e.target.value;
      if (v && !v.startsWith('/')) e.target.value = '/' + v;
    });

    Bus.on('topic-modal:open', () => _open());
  }

  function _open() {
    document.getElementById('tm-name').value = '/';
    document.getElementById('topic-modal-error').textContent = '';
    document.getElementById('topic-modal-overlay').classList.remove('hidden');
    const input = document.getElementById('tm-name');
    setTimeout(() => { input.focus(); input.setSelectionRange(1, 1); }, 60);
  }

  function _close() {
    document.getElementById('topic-modal-overlay').classList.add('hidden');
  }

  function _save() {
    const raw   = (document.getElementById('tm-name')?.value || '').trim();
    const errEl =  document.getElementById('topic-modal-error');

    if (!raw || raw === '/') {
      errEl.textContent = 'Topic name is required.';
      document.getElementById('tm-name').focus();
      return;
    }
    if (!/^\/[a-z_][a-z0-9_/]*$/.test(raw)) {
      errEl.textContent = 'Use lowercase letters, digits, underscores, slashes only.';
      return;
    }

    const pos = Canvas.getViewportCenter();
    Store.addTopic(raw, pos);
    _close();
  }

  return { init };
})();
