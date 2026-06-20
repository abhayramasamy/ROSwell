/* js/state/bus.js — Event bus */
window.Bus = (() => {
  const _listeners = {};

  return {
    on(event, fn)  { (_listeners[event] ??= []).push(fn); },
    off(event, fn) { _listeners[event] = (_listeners[event] || []).filter(f => f !== fn); },
    emit(event, data) { (_listeners[event] || []).forEach(fn => fn(data)); }
  };
})();
