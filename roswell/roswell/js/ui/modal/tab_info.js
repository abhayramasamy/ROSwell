/* js/ui/modal/tab_info.js — INFO tab */
window.TabInfo = (() => {
  function render(draft) {
    return `
      <div class="modal-form">
        <div class="form-row">
          <label>Node ID</label>
          <div class="field-readonly">${draft.id}</div>
        </div>
        <div class="form-row align-top">
          <label>Description</label>
          <textarea id="fi-desc" rows="6" placeholder="Optional node description...">${draft.description || ''}</textarea>
        </div>
      </div>
    `;
  }

  function collect() {
    const el = document.getElementById('fi-desc');
    return { description: el ? el.value.trim() : '' };
  }

  return { render, collect };
})();
