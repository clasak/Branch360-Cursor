(function(global) {
  const pending = {};

  function start(actionType, contextId, meta) {
    const token = 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    pending[token] = {
      actionType: actionType,
      contextId: contextId || '',
      meta: meta || {},
      startedAt: Date.now()
    };
    return token;
  }

  function finish(token, metaUpdate) {
    const entry = pending[token];
    if (!entry) return;
    entry.completedAt = Date.now();
    entry.meta = Object.assign({}, entry.meta || {}, metaUpdate || {});
    const payload = {
      actionType: entry.actionType,
      contextId: entry.contextId,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      meta: entry.meta,
      environment: window.Branch360Environment || 'Live'
    };
    if (global.google && global.google.script && global.google.script.run && global.google.script.run.recordActivity) {
      global.google.script.run.recordActivity(payload);
    }
    delete pending[token];
  }

  global.ActivityClient = {
    start: start,
    finish: finish
  };
})(window);
