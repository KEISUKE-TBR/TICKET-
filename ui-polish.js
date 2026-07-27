(() => {
  const $ = id => document.getElementById(id);
  const toolLabels = {
    select: '選択ツール（V）',
    text: '文字ツール（T）',
    rect: '四角形ツール（R）',
    ellipse: '楕円ツール（O）',
    line: '線ツール（L）'
  };

  function afterReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else requestAnimationFrame(fn);
  }

  afterReady(() => {
    enhanceToolbar();
    addCanvasGuidance();
    addSidebarToggles();
    addTooltips();
    addShortcutDialog();
    addKeyboardTools();
    improveLabels();
  });

  function enhanceToolbar() {
    const bar = document.querySelector('.topbar');
    if (!bar || bar.dataset.polished) return;
    bar.dataset.polished = 'true';

    const divider = bar.querySelector('span[style*="width:1px"]');
    if (divider) divider.className = 'toolbar-divider';

    const newBtn = $('newBtn');
    const undoBtn = $('undoBtn');
    const redoBtn = $('redoBtn');
    const firstTool = bar.querySelector('.tool');
    const imageBtn = $('imageBtn');
    const saveBtn = $('saveBtn');
    const printBtn = $('printBtn');

    const fileGroup = makeGroup('ファイル');
    [newBtn, $('saveBtn'), $('loadBtn')].forEach(el => el && fileGroup.appendChild(el));

    const historyGroup = makeGroup('履歴');
    [undoBtn, redoBtn].forEach(el => el && historyGroup.appendChild(el));

    const toolsGroup = makeGroup('作成');
    [...bar.querySelectorAll('.tool'), imageBtn].forEach(el => el && toolsGroup.appendChild(el));

    const dataGroup = makeGroup('データ');
    [$('csvBtn'), $('previewBtn')].forEach(el => el && dataGroup.appendChild(el));

    const outputGroup = makeGroup('出力');
    if (printBtn) {
      printBtn.classList.add('primary-action');
      outputGroup.appendChild(printBtn);
    }

    const spacer = document.createElement('div');
    spacer.className = 'spacer';

    [...bar.children].forEach(child => {
      if (!child.classList.contains('brand') && !child.matches('input')) child.remove();
    });

    const brand = bar.querySelector('.brand');
    [fileGroup, historyGroup, toolsGroup, spacer, dataGroup, outputGroup].forEach(group => bar.appendChild(group));

    bar.querySelectorAll('input[hidden]').forEach(input => bar.appendChild(input));

    const titles = {
      newBtn: '新しいデザイン', undoBtn: '取り消す', redoBtn: 'やり直す', imageBtn: '画像を追加',
      saveBtn: 'デザインを保存', loadBtn: '保存データを開く', csvBtn: 'CSVを読み込む',
      previewBtn: '差し込み結果を確認', printBtn: '印刷画面を開く'
    };
    Object.entries(titles).forEach(([id, title]) => {
      const el = $(id); if (el) { el.dataset.tooltip = title; el.setAttribute('aria-label', title); }
    });
    bar.querySelectorAll('.tool').forEach(button => {
      const label = toolLabels[button.dataset.tool] || button.textContent;
      button.dataset.tooltip = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
      button.addEventListener('click', () => {
        bar.querySelectorAll('.tool').forEach(other => other.setAttribute('aria-pressed', other === button ? 'true' : 'false'));
        updateCanvasHelp();
      });
    });
  }

  function makeGroup(label) {
    const group = document.createElement('div');
    group.className = 'toolbar-group';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    return group;
  }

  function addCanvasGuidance() {
    const wrap = $('canvasWrap');
    if (!wrap || $('.cs-canvas-help')) return;
    const help = document.createElement('div');
    help.className = 'cs-canvas-help';
    help.setAttribute('aria-live', 'polite');
    wrap.appendChild(help);
    updateCanvasHelp();
  }

  function updateCanvasHelp() {
    const help = document.querySelector('.cs-canvas-help');
    if (!help) return;
    const active = document.querySelector('.tool.active')?.dataset.tool || 'select';
    const messages = {
      select: '要素をクリックして選択し、ドラッグで移動できます。',
      text: 'キャンバスをドラッグして文字枠を作成します。クリックだけでも追加できます。',
      rect: '始点からドラッグして四角形を作成します。',
      ellipse: 'ドラッグして楕円を作成します。<kbd>Shift</kbd>で正円になります。',
      line: '始点から終点へドラッグします。<kbd>Shift</kbd>で角度を固定します。'
    };
    help.innerHTML = messages[active] || messages.select;
  }

  function addSidebarToggles() {
    const wrap = $('canvasWrap');
    if (!wrap) return;
    const left = document.createElement('button');
    left.className = 'cs-sidebar-toggle left';
    left.textContent = '☰';
    left.dataset.tooltip = '左パネルを表示／非表示';
    left.setAttribute('aria-label', left.dataset.tooltip);
    left.onclick = () => {
      document.body.classList.toggle('cs-left-collapsed');
      left.setAttribute('aria-pressed', document.body.classList.contains('cs-left-collapsed') ? 'true' : 'false');
    };
    const right = document.createElement('button');
    right.className = 'cs-sidebar-toggle right';
    right.textContent = '⚙';
    right.dataset.tooltip = '右パネルを表示／非表示';
    right.setAttribute('aria-label', right.dataset.tooltip);
    right.onclick = () => {
      document.body.classList.toggle('cs-right-collapsed');
      right.setAttribute('aria-pressed', document.body.classList.contains('cs-right-collapsed') ? 'true' : 'false');
    };
    wrap.append(left, right);
  }

  function addTooltips() {
    const tip = document.createElement('div');
    tip.className = 'cs-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    let timer;
    document.addEventListener('pointerover', event => {
      const target = event.target.closest('[data-tooltip]');
      if (!target) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const rect = target.getBoundingClientRect();
        tip.textContent = target.dataset.tooltip;
        tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, rect.left + rect.width / 2 - 70))}px`;
        tip.style.top = `${Math.min(innerHeight - 40, rect.bottom + 7)}px`;
        tip.classList.add('show');
      }, 420);
    });
    document.addEventListener('pointerout', event => {
      if (!event.target.closest('[data-tooltip]')) return;
      clearTimeout(timer); tip.classList.remove('show');
    });
  }

  function addShortcutDialog() {
    const modal = document.createElement('div');
    modal.className = 'cs-shortcuts';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'キーボードショートカット');
    modal.innerHTML = `
      <div class="cs-shortcuts-card">
        <div class="cs-shortcuts-header"><h2>キーボードショートカット</h2><button type="button" data-close-shortcuts aria-label="閉じる">閉じる</button></div>
        <div class="cs-shortcuts-list">
          <strong>選択ツール</strong><span><kbd>V</kbd></span>
          <strong>文字ツール</strong><span><kbd>T</kbd></span>
          <strong>四角形ツール</strong><span><kbd>R</kbd></span>
          <strong>楕円ツール</strong><span><kbd>O</kbd></span>
          <strong>線ツール</strong><span><kbd>L</kbd></span>
          <strong>取り消す</strong><span><kbd>Ctrl / ⌘</kbd> + <kbd>Z</kbd></span>
          <strong>複製</strong><span><kbd>Ctrl / ⌘</kbd> + <kbd>D</kbd></span>
          <strong>削除</strong><span><kbd>Delete</kbd></span>
          <strong>作成を中止</strong><span><kbd>Esc</kbd></span>
          <strong>この画面を開く</strong><span><kbd>?</kbd></span>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close-shortcuts]').onclick = () => modal.classList.remove('open');
    modal.addEventListener('pointerdown', event => { if (event.target === modal) modal.classList.remove('open'); });
  }

  function addKeyboardTools() {
    const map = { v: 'select', t: 'text', r: 'rect', o: 'ellipse', l: 'line' };
    document.addEventListener('keydown', event => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
      if (typing) return;
      if (event.key === '?') {
        event.preventDefault(); document.querySelector('.cs-shortcuts')?.classList.add('open'); return;
      }
      if (event.key === 'Escape') document.querySelector('.cs-shortcuts')?.classList.remove('open');
      const tool = map[event.key.toLowerCase()];
      if (!tool || event.ctrlKey || event.metaKey || event.altKey) return;
      const button = document.querySelector(`.tool[data-tool="${tool}"]`);
      if (button) { event.preventDefault(); button.click(); }
    });
  }

  function improveLabels() {
    const status = $('status');
    if (status) status.setAttribute('aria-live', 'polite');
    const nothing = $('nothingSelected');
    if (nothing) nothing.textContent = 'キャンバスまたはレイヤーから要素を選択すると、ここで色・文字・配置を調整できます。';
    const print = $('printBtn');
    if (print) print.textContent = '印刷';
  }
})();
