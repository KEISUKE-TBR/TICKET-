(() => {
  if (typeof state === 'undefined' || typeof renderAll !== 'function') return;

  const MIN_SIZE = 1.2;
  let gesture = null;

  const originalRenderAll = renderAll;
  renderAll = function unifiedRenderAll() {
    originalRenderAll();
    decorateSelection();
  };

  function selectedObject() {
    return state.objects.find(object => object.id === state.selected);
  }

  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll('.tool').forEach(button => {
      button.classList.toggle('active', button.dataset.tool === tool);
    });
  }

  function decorateSelection() {
    const node = document.querySelector('.obj.selected');
    if (!node) return;

    node.querySelectorAll('.handle').forEach(handle => handle.remove());

    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handles.forEach(direction => {
      const handle = document.createElement('div');
      handle.className = `handle unified-handle ${direction}`;
      handle.dataset.resize = direction;
      handle.setAttribute('aria-label', `${direction}方向へサイズ変更`);
      node.appendChild(handle);
    });

    const rotate = document.createElement('div');
    rotate.className = 'handle unified-handle rotate';
    rotate.dataset.rotate = 'true';
    rotate.setAttribute('aria-label', '回転');
    node.appendChild(rotate);
  }

  function beginGesture(event) {
    if (state.tool !== 'select') return;

    const handle = event.target.closest('.unified-handle');
    const node = event.target.closest('.obj');
    if (!node || !document.getElementById('artboard')?.contains(node)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const object = state.objects.find(item => item.id === node.dataset.id);
    if (!object) return;

    if (state.selected !== object.id) {
      state.selected = object.id;
      originalRenderAll();
      decorateSelection();
    }

    snapshot();

    const base = {
      id: object.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: object.x,
      y: object.y,
      w: object.w,
      h: object.h,
      rotation: object.rotation || 0,
      node: document.querySelector(`.obj[data-id="${CSS.escape(object.id)}"]`)
    };

    if (handle?.dataset.rotate) {
      const rect = document.getElementById('artboard').getBoundingClientRect();
      const centerX = rect.left + (object.x + object.w / 2) * MM * state.zoom;
      const centerY = rect.top + (object.y + object.h / 2) * MM * state.zoom;
      gesture = { ...base, kind: 'rotate', centerX, centerY };
    } else if (handle?.dataset.resize) {
      gesture = { ...base, kind: 'resize', direction: handle.dataset.resize, keepRatio: object.type === 'image' };
    } else {
      gesture = { ...base, kind: 'move' };
    }

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', finishGesture, true);
    window.addEventListener('pointercancel', cancelGesture, true);
  }

  function onMove(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const object = state.objects.find(item => item.id === gesture.id);
    if (!object) return;

    const dx = (event.clientX - gesture.startX) / (MM * state.zoom);
    const dy = (event.clientY - gesture.startY) / (MM * state.zoom);

    if (gesture.kind === 'move') {
      object.x = clamp(gesture.x + dx, 0, Math.max(0, state.doc.width - object.w));
      object.y = clamp(gesture.y + dy, 0, Math.max(0, state.doc.height - object.h));
    } else if (gesture.kind === 'rotate') {
      const angle = Math.atan2(event.clientY - gesture.centerY, event.clientX - gesture.centerX) * 180 / Math.PI + 90;
      object.rotation = event.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle);
    } else {
      resizeObject(object, dx, dy, event.shiftKey || gesture.keepRatio);
    }

    paintNode(object);
    renderInspector();
    renderStatus();
  }

  function resizeObject(object, dx, dy, preserveRatio) {
    const direction = gesture.direction;
    let left = gesture.x;
    let top = gesture.y;
    let right = gesture.x + gesture.w;
    let bottom = gesture.y + gesture.h;

    if (direction.includes('w')) left += dx;
    if (direction.includes('e')) right += dx;
    if (direction.includes('n')) top += dy;
    if (direction.includes('s')) bottom += dy;

    if (preserveRatio && direction.length === 2) {
      const ratio = gesture.w / Math.max(gesture.h, 0.001);
      let width = Math.max(MIN_SIZE, right - left);
      let height = Math.max(MIN_SIZE, bottom - top);
      if (Math.abs(dx) > Math.abs(dy)) height = width / ratio;
      else width = height * ratio;
      if (direction.includes('w')) left = right - width; else right = left + width;
      if (direction.includes('n')) top = bottom - height; else bottom = top + height;
    }

    left = clamp(left, 0, state.doc.width - MIN_SIZE);
    top = clamp(top, 0, state.doc.height - MIN_SIZE);
    right = clamp(right, left + MIN_SIZE, state.doc.width);
    bottom = clamp(bottom, top + MIN_SIZE, state.doc.height);

    object.x = left;
    object.y = top;
    object.w = right - left;
    object.h = bottom - top;
  }

  function paintNode(object) {
    const node = document.querySelector(`.obj[data-id="${CSS.escape(object.id)}"]`);
    if (!node) return;
    Object.assign(node.style, {
      left: `${object.x * MM}px`,
      top: `${object.y * MM}px`,
      width: `${object.w * MM}px`,
      height: `${object.h * MM}px`,
      transform: `rotate(${object.rotation || 0}deg)`
    });
  }

  function cleanup() {
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', finishGesture, true);
    window.removeEventListener('pointercancel', cancelGesture, true);
  }

  function finishGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    cleanup();
    gesture = null;
    originalRenderAll();
    decorateSelection();
  }

  function cancelGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const previous = state.history.pop();
    cleanup();
    gesture = null;
    if (previous) restore(previous);
  }

  document.addEventListener('pointerdown', beginGesture, true);

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && gesture) cancelGesture({ pointerId: gesture.pointerId });
    if (event.key.toLowerCase() === 'v' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      setTool('select');
    }
  });

  originalRenderAll();
  decorateSelection();
  toast('画像・文字・図形を同じ操作で移動・拡大縮小・回転できます');
})();
