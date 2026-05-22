/**
 * 应用主入口：UI 事件绑定、快捷键、家具拖入
 */
import { state, genId, subscribe } from './state.js';
import { setTheme, toggleTheme } from './theme.js';
import {
  initStage, stage, layers, screenToWorld,
  resetView, zoomBy, updateZoomDisplay, getPointerWorld,
} from './stage.js';
import { renderAll, renderObject } from './renderer.js';
import { activateTool, setSelected, deleteObject } from './tools.js';
import { FURNITURE_META, LIGHT_META } from './furniture.js';
import {
  pushHistory, undo, redo,
  newDocument, exportJSON, importJSON, exportPNG,
  loadAutoSave, autoSave,
} from './history.js';
import { renderLibraryThumbnails } from './thumbnails.js';
import { buildFloorDayTemplate } from './templates.js';
import { initAIPanel } from './ai/panel.js';

/* ============ 初始化 ============ */
window.addEventListener('DOMContentLoaded', () => {
  initStage('stage-container');
  bindToolbar();
  bindTopbar();
  bindZoomControls();
  bindSidebarTabs();
  bindLibrary();
  bindKeyboard();
  bindCoordinateDisplay();
  bindObjectInteraction();
  bindPropertyPanel();

  // 加载自动保存
  if (loadAutoSave()) {
    renderAll();
  } else {
    // 演示数据：放一个比例尺和指北针（cm 坐标，靠近原点）
    state.objects.push(
      { id: genId('scale'),   type: 'scale',   x: -50,  y: 60, totalCm: 500 },
      { id: genId('compass'), type: 'compass', x: 70,   y: 60, rotation: 0 },
    );
    pushHistory();
    renderAll();
  }

  activateTool('select');
  updateZoomDisplay();

  // 默认右侧面板：素材库
  setActiveTab('library');

  // 渲染素材库缩略图（需要 stage 初始化后再做）
  renderLibraryThumbnails();

  // AI 设计助手面板
  initAIPanel();

  // 调试入口：浏览器控制台可访问 window.__editor 检查/操作状态
  window.__editor = { state, stage, layers, renderAll, renderObject, genId, pushHistory };
});

/* ============ 工具栏 ============ */
function bindToolbar() {
  document.querySelectorAll('.tool[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tool;
      if (t === 'delete') {
        // 删除工具：如有选中直接删，否则进入删除模式
        if (state.selectedId) {
          deleteObject(state.selectedId);
          return;
        }
      }
      document.querySelectorAll('.tool[data-tool]').forEach(b => b.dataset.active = 'false');
      btn.dataset.active = 'true';
      activateTool(t);
    });
  });
}

/* ============ 顶栏 ============ */
function bindTopbar() {
  const map = {
    'new':         () => newDocument(),
    'template-floor-day': () => loadFloorDayTemplate(),
    'save':        () => exportJSON(),
    'load':        () => document.getElementById('fileInput').click(),
    'undo':        () => undo(),
    'redo':        () => redo(),
    'export-png':  () => exportPNG(stage),
    'export-json': () => exportJSON(),
    'toggle-theme':() => toggleTheme(),
  };
  document.querySelectorAll('[data-action]').forEach(btn => {
    const fn = map[btn.dataset.action];
    if (fn) btn.addEventListener('click', fn);
  });

  document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importJSON(file);
    e.target.value = '';
  });
}

/* ============ 缩放控件 ============ */
function bindZoomControls() {
  document.querySelector('[data-action="zoom-in"]').addEventListener('click', () => zoomBy(1.25));
  document.querySelector('[data-action="zoom-out"]').addEventListener('click', () => zoomBy(0.8));
  document.querySelector('[data-action="zoom-reset"]').addEventListener('click', () => resetView());
}

/* ============ Sidebar tabs ============ */
function bindSidebarTabs() {
  document.querySelectorAll('.tab[data-tab]').forEach(t => {
    t.addEventListener('click', () => setActiveTab(t.dataset.tab));
  });
}
function setActiveTab(name) {
  document.querySelectorAll('.tab[data-tab]').forEach(t => {
    t.dataset.active = String(t.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel[data-panel]').forEach(p => {
    p.hidden = p.dataset.panel !== name;
  });
}

/* ============ 家具/灯光库：拖入画布 ============ */
function bindLibrary() {
  const container = document.getElementById('stage-container');

  document.querySelectorAll('.lib-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      const data = item.dataset.furniture
        ? { kind: 'furniture', subtype: item.dataset.furniture }
        : { kind: 'light', subtype: item.dataset.light };
      e.dataTransfer.setData('application/x-floor-item', JSON.stringify(data));
      e.dataTransfer.effectAllowed = 'copy';
    });
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-floor-item');
    if (!raw) return;
    const data = JSON.parse(raw);
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    let obj;
    if (data.kind === 'furniture') {
      const meta = FURNITURE_META[data.subtype];
      obj = {
        id: genId('furn'),
        type: 'furniture',
        subtype: data.subtype,
        label: meta?.label || data.subtype,
        x: world.x, y: world.y,
        w: meta?.w || 100,
        h: meta?.h || 100,
        rotation: 0,
      };
    } else {
      const meta = LIGHT_META[data.subtype];
      obj = {
        id: genId('light'),
        type: 'light',
        subtype: data.subtype,
        label: meta?.label || data.subtype,
        x: world.x, y: world.y,
        rotation: 0,
      };
    }
    state.objects.push(obj);
    pushHistory();
    renderObject(obj);
    Object.values(layers).forEach(l => l.batchDraw());
    setSelected(obj.id);
  });
}

/* ============ 键盘快捷键 ============ */
function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const meta = e.metaKey || e.ctrlKey;

    if (meta && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (meta && e.key.toLowerCase() === 's') {
      e.preventDefault();
      exportJSON();
      return;
    }

    // 工具快捷键
    const map = { v: 'select', b: 'marquee', w: 'wall', d: 'door', n: 'window', t: 'text', m: 'dimension' };
    const tool = map[e.key.toLowerCase()];
    if (tool) {
      const btn = document.querySelector(`.tool[data-tool="${tool}"]`);
      if (btn) btn.click();
    }

    // 删除（单选 / 多选）
    if ((e.key === 'Delete' || e.key === 'Backspace')) {
      const ids = state.selectedId
        ? [state.selectedId]
        : (state.multiSelectIds || []);
      if (ids.length > 0) {
        e.preventDefault();
        ids.slice().forEach(id => deleteObject(id));
      }
    }

    // 主题切换
    if (e.key.toLowerCase() === 'l' && !meta) {
      toggleTheme();
    }
  });
}

/* ============ 坐标显示 ============ */
function bindCoordinateDisplay() {
  const el = document.getElementById('statusCoord');
  stage.on('mousemove', () => {
    const p = getPointerWorld();
    if (!p) return;
    el.textContent = `坐标：${p.x.toFixed(0)}, ${p.y.toFixed(0)} cm`;
  });
}

/* ============ 对象交互：拖动后保存历史 + 选中 ============ */
function bindObjectInteraction() {
  // 通用：任何 group/line 拖动结束 → 同步到 state + history
  ['walls', 'openings', 'furniture', 'lights', 'annotations'].forEach(layerKey => {
    layers[layerKey].on('dragend', (e) => {
      const node = e.target;
      const id = node.id();
      const obj = state.objects.find(o => o.id === id);
      if (!obj) return;
      // 墙：dragend 时同步两端
      if (obj.type === 'wall') {
        const dx = node.x();
        const dy = node.y();
        if (dx || dy) {
          obj.points = [
            obj.points[0] + dx, obj.points[1] + dy,
            obj.points[2] + dx, obj.points[3] + dy,
          ];
          node.position({ x: 0, y: 0 });
          node.points(obj.points);
        }
      } else {
        obj.x = node.x();
        obj.y = node.y();
      }
      pushHistory();
    });

    // 旋转/缩放变换结束
    layers[layerKey].on('transformend', (e) => {
      const node = e.target;
      const id = node.id();
      const obj = state.objects.find(o => o.id === id);
      if (!obj) return;
      obj.x = node.x();
      obj.y = node.y();
      obj.rotation = node.rotation();
      // scale → 转成宽高
      if (obj.w !== undefined) {
        obj.w = obj.w * node.scaleX();
        obj.h = obj.h * node.scaleY();
        node.scale({ x: 1, y: 1 });
      }
      pushHistory();
      // 重绘该对象（家具内部图形需要按新尺寸重建）
      const old = node;
      const newNode = renderObject(obj);
      old.destroy();
      // 重新选中以更新 transformer
      setSelected(obj.id);
    });
  });
}

/* ============ 属性面板 ============ */
function bindPropertyPanel() {
  const empty = document.getElementById('propsEmpty');
  const form = document.getElementById('propsForm');
  const inputs = {
    name: document.getElementById('propName'),
    x: document.getElementById('propX'),
    y: document.getElementById('propY'),
    w: document.getElementById('propW'),
    h: document.getElementById('propH'),
    rotation: document.getElementById('propRotation'),
  };

  function refresh() {
    const id = state.selectedId;
    if (!id) {
      empty.hidden = false;
      form.hidden = true;
      return;
    }
    const obj = state.objects.find(o => o.id === id);
    if (!obj) return;
    empty.hidden = true;
    form.hidden = false;
    inputs.name.value = obj.label || obj.text || obj.type;
    inputs.x.value = Math.round(obj.x ?? obj.points?.[0] ?? 0);
    inputs.y.value = Math.round(obj.y ?? obj.points?.[1] ?? 0);
    inputs.w.value = Math.round(obj.w ?? 0);
    inputs.h.value = Math.round(obj.h ?? 0);
    inputs.rotation.value = Math.round(obj.rotation ?? 0);
  }

  subscribe((event) => {
    if (event === 'selection:change') {
      // 切到属性 tab 更直观
      if (state.selectedId) setActiveTab('props');
      refresh();
    }
  });

  function applyFromInputs() {
    const id = state.selectedId;
    if (!id) return;
    const obj = state.objects.find(o => o.id === id);
    if (!obj) return;
    if (obj.type === 'text') obj.text = inputs.name.value;
    else obj.label = inputs.name.value;
    obj.x = parseFloat(inputs.x.value) || 0;
    obj.y = parseFloat(inputs.y.value) || 0;
    if (obj.w !== undefined) obj.w = parseFloat(inputs.w.value) || obj.w;
    if (obj.h !== undefined) obj.h = parseFloat(inputs.h.value) || obj.h;
    obj.rotation = parseFloat(inputs.rotation.value) || 0;
    pushHistory();
    renderAll();
    setSelected(id);
  }
  Object.values(inputs).forEach(i => i.addEventListener('change', applyFromInputs));

  document.getElementById('propRotateLeft').addEventListener('click', () => {
    inputs.rotation.value = (parseFloat(inputs.rotation.value) || 0) - 90;
    applyFromInputs();
  });
  document.getElementById('propRotateRight').addEventListener('click', () => {
    inputs.rotation.value = (parseFloat(inputs.rotation.value) || 0) + 90;
    applyFromInputs();
  });
  document.getElementById('propDelete').addEventListener('click', () => {
    if (state.selectedId) deleteObject(state.selectedId);
  });
}

/* ============ 模板加载 ============ */
function loadFloorDayTemplate() {
  const hasUserContent = state.objects.some(o => !['scale', 'compass'].includes(o.type));
  if (hasUserContent) {
    if (!confirm('加载示例模板将覆盖当前内容，是否继续？')) return;
  }
  state.objects = buildFloorDayTemplate();
  state.selectedId = null;
  state.history = [JSON.stringify(state.objects)];
  state.historyIndex = 0;
  renderAll();
  // 自动缩放到合适视图，让户型整体居中
  fitTemplateToView();
  // 持久化
  import('./history.js').then(m => m.autoSave());
}

function fitTemplateToView() {
  // 模板范围约 -700..+800 横向，-600..+700 纵向（含阳台）
  const bbox = { minX: -800, maxX: 850, minY: -700, maxY: 720 };
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const padding = 80;
  const stageW = stage.width() - padding * 2;
  const stageH = stage.height() - padding * 2;
  const zoom = Math.min(stageW / w, stageH / h);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  stage.scale({ x: zoom, y: zoom });
  stage.position({
    x: stage.width() / 2 - cx * zoom,
    y: stage.height() / 2 - cy * zoom,
  });
  state.zoom = zoom;
  stage.batchDraw();
  updateZoomDisplay();
}
