/**
 * 工具系统：墙、门、窗、文字、尺寸、比例尺、指北针
 *
 * 通用模式：每个工具激活后注册 stage 事件，工具切换时清理。
 */
import { state, genId, emit } from './state.js';
import { stage, getPointerWorld, layers } from './stage.js';
import { themeColors } from './theme.js';
import { renderObject } from './renderer.js';
import { pushHistory } from './history.js';

let cleanupFn = null;
let previewNode = null;

function clearPreview() {
  if (previewNode) { previewNode.destroy(); previewNode = null; }
  layers.ui.batchDraw();
}

export function activateTool(toolName) {
  if (cleanupFn) { cleanupFn(); cleanupFn = null; }
  clearPreview();
  state.tool = toolName;
  document.querySelector('.canvas-area').dataset.tool = toolName;

  const hint = document.getElementById('statusHint');
  const toolStatus = document.getElementById('statusTool');

  const handlers = {
    select:    activateSelect,
    wall:      activateWall,
    door:      placeOnClick('door',     { w: 80 },  '门'),
    window:    placeOnClick('window',   { w: 120 }, '窗'),
    text:      placeOnClick('text',     { text: '双击编辑' }, '文字'),
    dimension: activateDimension,
    scale:     placeOnClick('scale',    { totalCm: 500 }, '比例尺'),
    compass:   placeOnClick('compass',  {}, '指北针'),
    delete:    activateDelete,
  };

  const labels = {
    select: '选择', wall: '画墙', door: '门', window: '窗',
    text: '文字', dimension: '尺寸', scale: '比例尺',
    compass: '指北针', delete: '删除',
  };
  const hints = {
    select: '点击选中对象，拖拽移动；按 Delete 删除',
    wall: '点击放置墙体起点，再点击放置终点；ESC 取消',
    door: '点击画布放置门，可在右侧旋转',
    window: '点击画布放置窗',
    text: '点击画布放置文字，双击可编辑',
    dimension: '点击两点绘制尺寸标注',
    scale: '点击画布放置比例尺',
    compass: '点击画布放置指北针',
    delete: '点击对象将其删除',
  };
  toolStatus.textContent = `工具：${labels[toolName] || toolName}`;
  hint.textContent = hints[toolName] || '';

  cleanupFn = handlers[toolName]?.();
}

/* ====== 选择工具：点击对象选中 ====== */
function activateSelect() {
  const onClick = (e) => {
    if (e.target === stage) {
      setSelected(null);
      return;
    }
    const id = findIdFromTarget(e.target);
    if (id) setSelected(id);
  };
  stage.on('click.select', onClick);
  return () => stage.off('click.select');
}

function findIdFromTarget(target) {
  let n = target;
  while (n && !n.id()) n = n.getParent();
  return n?.id() || null;
}

export function setSelected(id) {
  state.selectedId = id;
  drawSelectionHandle();
  emit('selection:change', id);
}

let transformer = null;
function drawSelectionHandle() {
  if (transformer) { transformer.destroy(); transformer = null; }
  if (!state.selectedId) { layers.ui.batchDraw(); return; }
  const node = findAnyNode(state.selectedId);
  if (!node) { layers.ui.batchDraw(); return; }
  const c = themeColors();
  transformer = new Konva.Transformer({
    nodes: [node],
    rotateEnabled: true,
    enabledAnchors: ['top-left','top-right','bottom-left','bottom-right'],
    borderStroke: c.selection,
    anchorStroke: c.selection,
    anchorFill: c.canvasBg,
    anchorSize: 8,
    rotateAnchorOffset: 22,
  });
  layers.ui.add(transformer);
  layers.ui.batchDraw();
}

function findAnyNode(id) {
  for (const k of ['walls','openings','furniture','lights','annotations']) {
    const n = layers[k].findOne(`#${id}`);
    if (n) return n;
  }
  return null;
}

/* ====== 墙体工具：连续点击画折线墙 ====== */
function activateWall() {
  const c = themeColors();
  const thickness = 20;
  let start = null;

  const onMove = () => {
    if (!start) return;
    const p = getPointerWorld();
    if (!p) return;
    const snapped = snapAngle(start, p, 15); // 每 15° 吸附
    if (!previewNode) {
      previewNode = new Konva.Line({
        points: [start.x, start.y, snapped.x, snapped.y],
        stroke: c.wallFill,
        strokeWidth: thickness,
        opacity: 0.45,
        listening: false,
      });
      layers.ui.add(previewNode);
    } else {
      previewNode.points([start.x, start.y, snapped.x, snapped.y]);
    }
    layers.ui.batchDraw();
  };

  const onClick = () => {
    const p = getPointerWorld();
    if (!p) return;
    if (!start) {
      start = p;
      return;
    }
    const snapped = snapAngle(start, p, 15);
    const obj = {
      id: genId('wall'),
      type: 'wall',
      points: [start.x, start.y, snapped.x, snapped.y],
      thickness,
    };
    state.objects.push(obj);
    pushHistory();
    renderObject(obj);
    layers.walls.batchDraw();
    // 接续：终点变新起点
    start = snapped;
    clearPreview();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      start = null;
      clearPreview();
    }
  };

  stage.on('mousemove.wall', onMove);
  stage.on('click.wall', onClick);
  window.addEventListener('keydown', onKey);

  return () => {
    stage.off('mousemove.wall click.wall');
    window.removeEventListener('keydown', onKey);
    clearPreview();
  };
}

function snapAngle(p0, p1, stepDeg) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return p1;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const snapped = Math.round(ang / stepDeg) * stepDeg;
  const rad = snapped * Math.PI / 180;
  return { x: p0.x + Math.cos(rad) * len, y: p0.y + Math.sin(rad) * len };
}

/* ====== 通用：点击放置一个对象 ====== */
function placeOnClick(type, defaults, label) {
  return () => {
    const onClick = () => {
      const p = getPointerWorld();
      if (!p) return;
      const obj = {
        id: genId(type),
        type,
        x: p.x, y: p.y,
        rotation: 0,
        ...defaults,
      };
      state.objects.push(obj);
      pushHistory();
      renderObject(obj);
      Object.values(layers).forEach(l => l.batchDraw());
    };
    stage.on('click.place', onClick);
    return () => stage.off('click.place');
  };
}

/* ====== 尺寸标注：点击两点 ====== */
function activateDimension() {
  let start = null;
  const c = themeColors();

  const onMove = () => {
    if (!start) return;
    const p = getPointerWorld();
    if (!p) return;
    if (!previewNode) {
      previewNode = new Konva.Line({
        points: [start.x, start.y, p.x, p.y],
        stroke: c.textCanvasSec, strokeWidth: 0.8, dash: [4, 3],
        listening: false,
      });
      layers.ui.add(previewNode);
    } else {
      previewNode.points([start.x, start.y, p.x, p.y]);
    }
    layers.ui.batchDraw();
  };

  const onClick = () => {
    const p = getPointerWorld();
    if (!p) return;
    if (!start) { start = p; return; }
    const obj = {
      id: genId('dim'),
      type: 'dimension',
      points: [start.x, start.y, p.x, p.y],
    };
    state.objects.push(obj);
    pushHistory();
    renderObject(obj);
    layers.annotations.batchDraw();
    start = null;
    clearPreview();
  };

  stage.on('mousemove.dim', onMove);
  stage.on('click.dim', onClick);
  return () => {
    stage.off('mousemove.dim click.dim');
    clearPreview();
  };
}

/* ====== 删除工具 ====== */
function activateDelete() {
  const onClick = (e) => {
    if (e.target === stage) return;
    const id = findIdFromTarget(e.target);
    if (id) deleteObject(id);
  };
  stage.on('click.del', onClick);
  return () => stage.off('click.del');
}

export function deleteObject(id) {
  const idx = state.objects.findIndex(o => o.id === id);
  if (idx < 0) return;
  state.objects.splice(idx, 1);
  const node = findAnyNode(id);
  if (node) node.destroy();
  if (state.selectedId === id) setSelected(null);
  pushHistory();
  Object.values(layers).forEach(l => l.batchDraw());
  emit('canvas:rerender-counts');
}
