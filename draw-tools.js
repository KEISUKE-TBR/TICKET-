(() => {
  const DRAW_TOOLS = new Set(['text', 'rect', 'ellipse', 'line']);
  const MIN_MM = 0.8;
  let drawing = null;

  const artboard = document.getElementById('artboard');
  if (!artboard || typeof state === 'undefined') return;

  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));

  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll('.tool').forEach(button => {
      button.classList.toggle('active', button.dataset.tool === tool);
    });
    artboard.style.cursor = DRAW_TOOLS.has(tool) ? 'crosshair' : 'default';
  }

  function getPoint(event) {
    const rect = artboard.getBoundingClientRect();
    const x = (event.clientX - rect.left) / (MM * state.zoom);
    const y = (event.clientY - rect.top) / (MM * state.zoom);
    return {
      x: clampValue(x, 0, state.doc.width),
      y: clampValue(y, 0, state.doc.height)
    };
  }

  function createDraft(tool, point) {
    const common = {
      id: uid(),
      x: point.x,
      y: point.y,
      w: 0.01,
      h: 0.01,
      rotation: 0,
      opacity: 100,
      visible: true
    };

    if (tool === 'text') {
      return {
        ...common,
        type: 'text',
        name: 'テキスト',
        text: 'テキスト',
        font: 'Noto Sans JP',
        fontSize: 12,
        weight: 400,
        letter: 0,
        line: 1.2,
        color: '#111111',
        align: 'left'
      };
    }

    return {
      ...common,
      type: 'shape',
      name: tool === 'rect' ? '四角形' : tool === 'ellipse' ? '円' : '線',
      shape: tool === 'rect' ? 'rect' : tool === 'ellipse' ? 'ellipse' : 'line',
      fill: '#dbe7ff',
      stroke: '#5271ff',
      strokeWidth: 0.3,
      radius: 0
    };
  }

  function updateBox(object, start, end, keepSquare) {
    let dx = end.x - start.x;
    let dy = end.y - start.y;

    if (keepSquare) {
      const size = Math.min(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * size;
      dy = Math.sign(dy || 1) * size;
    }

    const endX = start.x + dx;
    const endY = start.y + dy;
    object.x = Math.min(start.x, endX);
    object.y = Math.min(start.y, endY);
    object.w = Math.max(0.01, Math.abs(dx));
    object.h = Math.max(0.01, Math.abs(dy));
  }

  function snapLineEnd(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return end;
    const step = Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    return {
      x: clampValue(start.x + Math.cos(angle) * distance, 0, state.doc.width),
      y: clampValue(start.y + Math.sin(angle) * distance, 0, state.doc.height)
    };
  }

  function updateLine(object, start, end, snap) {
    const target = snap ? snapLineEnd(start, end) : end;
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const distance = Math.max(0.01, Math.hypot(dx, dy));
    object.x = (start.x + target.x) / 2 - distance / 2;
    object.y = (start.y + target.y) / 2 - 1;
    object.w = distance;
    object.h = 2;
    object.rotation = Math.atan2(dy, dx) * 180 / Math.PI;
  }

  function onPointerDown(event) {
    if (!DRAW_TOOLS.has(state.tool)) return;
    if (!artboard.contains(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const start = getPoint(event);
    snapshot();
    const object = createDraft(state.tool, start);
    state.objects.push(object);
    state.selected = object.id;
    drawing = {
      pointerId: event.pointerId,
      tool: state.tool,
      start,
      object,
      moved: false
    };

    renderAll();
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
  }

  function onPointerMove(event) {
    if (!drawing || event.pointerId !== drawing.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const end = getPoint(event);
    const dx = end.x - drawing.start.x;
    const dy = end.y - drawing.start.y;
    drawing.moved = Math.hypot(dx, dy) >= MIN_MM;

    if (drawing.tool === 'line') {
      updateLine(drawing.object, drawing.start, end, event.shiftKey);
    } else {
      updateBox(drawing.object, drawing.start, end, drawing.tool === 'ellipse' && event.shiftKey);
    }

    renderAll();
  }

  function cleanupListeners() {
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerCancel, true);
  }

  function cancelDraft() {
    if (!drawing) return;
    const index = state.objects.findIndex(object => object.id === drawing.object.id);
    if (index >= 0) state.objects.splice(index, 1);
    state.selected = null;
    state.history.pop();
    drawing = null;
    cleanupListeners();
    setTool('select');
    renderAll();
  }

  function onPointerCancel(event) {
    if (!drawing || event.pointerId !== drawing.pointerId) return;
    cancelDraft();
  }

  function onPointerUp(event) {
    if (!drawing || event.pointerId !== drawing.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const completed = drawing;
    drawing = null;
    cleanupListeners();

    if (!completed.moved) {
      if (completed.tool === 'text') {
        Object.assign(completed.object, {
          x: completed.start.x,
          y: completed.start.y,
          w: Math.min(30, state.doc.width - completed.start.x),
          h: Math.min(12, state.doc.height - completed.start.y)
        });
      } else {
        const index = state.objects.findIndex(object => object.id === completed.object.id);
        if (index >= 0) state.objects.splice(index, 1);
        state.selected = null;
        state.history.pop();
        setTool('select');
        renderAll();
        toast('ドラッグして大きさを指定してください');
        return;
      }
    }

    state.selected = completed.object.id;
    setTool('select');
    renderAll();

    if (completed.tool === 'text') {
      setTimeout(() => {
        const input = document.getElementById('pText');
        if (input) {
          input.focus();
          input.select();
        }
      }, 0);
    }
  }

  document.addEventListener('pointerdown', onPointerDown, true);

  document.querySelectorAll('.tool').forEach(button => {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawing) cancelDraft();
  });

  setTool(state.tool);
  toast('文字・図形はキャンバス上でドラッグして配置できます');
})();
