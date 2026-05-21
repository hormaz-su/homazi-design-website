/**
 * 工具系统：选择、框选、墙、门、窗、文字、尺寸、比例尺、指北针
 *
 * 通用模式：每个工具激活后注册 stage 事件，工具切换时清理。
 */
import { state, genId, emit } from './state.js';
import { stage, getPointerWorld, layers, screenToWorld, startStagePan } from './stage.js';
import { themeColors } from './theme.js';
import { renderObject, renderAll } from './renderer.js';
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
  // 切换工具时清空多选
  clearMultiSelection();
  state.tool = toolName;
  document.querySelector('.canvas-area').dataset.tool = toolName;

  const hint = document.getElementById('statusHint');
  const toolStatus = document.getElementById('statusTool');

  const handlers = {
    select:    activateSelect,
    marquee:   activateMarquee,
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
    select: '选择', marquee: '框选', wall: '画墙', door: '门', window: '窗',
    text: '文字', dimension: '尺寸', scale: '比例尺',
    compass: '指北针', delete: '删除',
  };
  const hints = {
    select: '点击对象选中并拖动；点击空白处拖拽可平移整个画板；按 Delete 删除',
    marquee: '在空白处拖出矩形批量选中；选中后可整体拖动；ESC 取消',
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

/* ====== 选择工具：点击对象选中、拖动；点空白拖 = 平移画板 ====== */
function activateSelect() {
  let downAt = null;          // mousedown 时屏幕坐标
  let downOnStage = false;    // 是否点在了空白处
  let panning = false;
  const DRAG_THRESHOLD = 4;   // 像素

  const onMouseDown = (e) => {
    // 仅左键
    if (e.evt.button !== 0) return;
    downAt = { x: e.evt.clientX, y: e.evt.clientY };
    downOnStage = (e.target === stage);
    panning = false;
  };

  const onMouseMove = (e) => {
    if (!downAt || !downOnStage || panning) return;
    const dx = e.evt.clientX - downAt.x;
    const dy = e.evt.clientY - downAt.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      // 转入平移模式
      panning = true;
      startStagePan({ clientX: e.evt.clientX, clientY: e.evt.clientY });
    }
  };

  const onMouseUp = (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.evt.clientX - downAt.x, e.evt.clientY - downAt.y);
    // 没有移动（或移动很小）→ 视为点击
    if (!panning && moved < DRAG_THRESHOLD) {
      if (e.target === stage) {
        setSelected(null);
      } else {
        const id = findIdFromTarget(e.target);
        if (id) setSelected(id);
      }
    }
    downAt = null;
    downOnStage = false;
    panning = false;
  };

  // 单选对象拖动结束 → 同步 state
  const onDragEnd = (e) => {
    if (!state.selectedId) return;
    const node = e.target;
    let n = node;
    while (n && n.id() !== state.selectedId) n = n.getParent();
    if (!n) return;
    const obj = state.objects.find(o => o.id === state.selectedId);
    if (!obj) return;
    syncObjectFromNode(obj, n);
    pushHistory();
  };

  stage.on('mousedown.select', onMouseDown);
  stage.on('mousemove.select', onMouseMove);
  stage.on('mouseup.select', onMouseUp);
  stage.on('dragend.select', onDragEnd);
  return () => stage.off('mousedown.select mousemove.select mouseup.select dragend.select');
}

function findIdFromTarget(target) {
  let n = target;
  while (n && !n.id()) n = n.getParent();
  return n?.id() || null;
}

export function setSelected(id) {
  // 单选时清掉多选状态
  state.multiSelectIds = [];
  destroyMultiTransformer();
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

/* ====== 把 Konva 节点的当前位置/旋转写回 state 对象 ====== */
function syncObjectFromNode(obj, node) {
  if (Array.isArray(obj.points)) {
    // wall / dimension 等用 points[]：节点 (x,y) 即整体平移量
    const dx = node.x();
    const dy = node.y();
    obj.points = obj.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy);
    node.position({ x: 0, y: 0 });
  } else {
    obj.x = node.x();
    obj.y = node.y();
    if (typeof node.rotation === 'function') obj.rotation = node.rotation();
  }
}

/* ====== 多选状态 ====== */
let multiTransformer = null;

function destroyMultiTransformer() {
  if (multiTransformer) {
    multiTransformer.destroy();
    multiTransformer = null;
    layers.ui.batchDraw();
  }
}

function clearMultiSelection() {
  state.multiSelectIds = [];
  destroyMultiTransformer();
  // 同时把节点的 draggable 收回（避免遗留）
  for (const k of ['walls','openings','furniture','lights','annotations']) {
    layers[k].getChildren().forEach(n => {
      if (n._wasMultiDraggable) {
        n.draggable(false);
        delete n._wasMultiDraggable;
      }
    });
  }
}

/**
 * 应用多选（id 列表）：用 Transformer 包住、监听拖动整体写回 state
 *
 * 联动拖动策略：在被拖节点的 dragstart 时记录所有节点起始位置，
 * dragmove 时计算 dx/dy 应用到其它节点；dragend 时统一写回 state。
 */
function applyMultiSelection(ids) {
  destroyMultiTransformer();
  state.selectedId = null;
  state.multiSelectIds = ids;
  drawSelectionHandle(); // 清掉单选 transformer

  const nodes = ids.map(findAnyNode).filter(Boolean);
  if (nodes.length === 0) {
    state.multiSelectIds = [];
    return;
  }

  // 让节点都 draggable
  nodes.forEach(n => {
    if (!n.draggable()) {
      n.draggable(true);
      n._wasMultiDraggable = true;
    }
  });

  const c = themeColors();
  multiTransformer = new Konva.Transformer({
    nodes,
    rotateEnabled: false,
    resizeEnabled: false,
    borderStroke: c.selection,
    borderDash: [4, 3],
    anchorSize: 0,
  });
  layers.ui.add(multiTransformer);
  layers.ui.batchDraw();

  // 记录每个节点 dragstart 时的起始位置；拖某一个时联动其它
  let startMap = null;
  let dragSource = null;

  nodes.forEach(n => {
    n.on('dragstart.multi', () => {
      dragSource = n;
      startMap = new Map();
      nodes.forEach(m => startMap.set(m.id(), { x: m.x(), y: m.y() }));
    });
    n.on('dragmove.multi', () => {
      if (!startMap || dragSource !== n) return;
      const start = startMap.get(n.id());
      const dx = n.x() - start.x;
      const dy = n.y() - start.y;
      nodes.forEach(m => {
        if (m === n) return;
        const s = startMap.get(m.id());
        m.position({ x: s.x + dx, y: s.y + dy });
      });
      // 同步 transformer 框
      multiTransformer?.forceUpdate();
    });
    n.on('dragend.multi', () => {
      if (!startMap) return;
      // 把所有节点的位移写回 state
      nodes.forEach(m => {
        const s = startMap.get(m.id());
        const obj = state.objects.find(o => o.id === m.id());
        if (!obj || !s) return;
        const dx = m.x() - s.x;
        const dy = m.y() - s.y;
        if (dx === 0 && dy === 0) return;
        applyDelta(obj, dx, dy);
        if (Array.isArray(obj.points)) {
          m.position({ x: 0, y: 0 });
        }
      });
      startMap = null;
      dragSource = null;
      pushHistory();
    });
  });

  emit('selection:change', null);
}

/**
 * 把平移 dx/dy 应用到 obj 的位置/points
 */
function applyDelta(obj, dx, dy) {
  if (Array.isArray(obj.points)) {
    obj.points = obj.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy);
  } else {
    obj.x = (obj.x || 0) + dx;
    obj.y = (obj.y || 0) + dy;
  }
}

/* ====== 框选工具：拖出橡皮筋矩形批量选择 ====== */
function activateMarquee() {
  let downAt = null;       // 屏幕坐标
  let downWorld = null;    // 世界坐标
  let rect = null;
  let dragging = false;
  let panningEmpty = false;

  const onMouseDown = (e) => {
    if (e.evt.button !== 0) return;
    // 点在已选中节点（multi 集合内）→ 让 Konva 默认 drag 接管整体移动
    if (e.target !== stage) {
      const id = findIdFromTarget(e.target);
      if (id && state.multiSelectIds && state.multiSelectIds.includes(id)) {
        return;
      }
      // 点在未选中对象 → 立刻单选它，并切回 select 行为（不开启橡皮筋）
      if (id) {
        clearMultiSelection();
        setSelected(id);
        return;
      }
    }
    // 点空白
    downAt = { x: e.evt.clientX, y: e.evt.clientY };
    downWorld = getPointerWorld();
    dragging = false;
    panningEmpty = false;
  };

  const onMouseMove = (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.evt.clientX - downAt.x, e.evt.clientY - downAt.y);
    if (!dragging && moved < 4) return;
    dragging = true;

    const cur = getPointerWorld();
    if (!cur) return;
    const x1 = Math.min(downWorld.x, cur.x);
    const y1 = Math.min(downWorld.y, cur.y);
    const w = Math.abs(cur.x - downWorld.x);
    const h = Math.abs(cur.y - downWorld.y);

    const c = themeColors();
    if (!rect) {
      rect = new Konva.Rect({
        x: x1, y: y1, width: w, height: h,
        stroke: c.selection,
        strokeWidth: 1 / stage.scaleX(),
        dash: [6 / stage.scaleX(), 4 / stage.scaleX()],
        fill: c.selection,
        opacity: 0.08,
        listening: false,
      });
      layers.ui.add(rect);
    } else {
      rect.position({ x: x1, y: y1 });
      rect.size({ width: w, height: h });
    }
    layers.ui.batchDraw();
  };

  const onMouseUp = (e) => {
    if (!downAt) return;
    if (dragging && rect) {
      // 计算与该矩形相交的对象
      const bbox = {
        x1: rect.x(), y1: rect.y(),
        x2: rect.x() + rect.width(), y2: rect.y() + rect.height(),
      };
      const ids = pickInBox(bbox);
      rect.destroy(); rect = null;
      layers.ui.batchDraw();

      if (ids.length === 1) {
        clearMultiSelection();
        setSelected(ids[0]);
      } else if (ids.length > 1) {
        applyMultiSelection(ids);
      } else {
        clearMultiSelection();
        setSelected(null);
      }
    } else if (!dragging) {
      // 点击空白 → 清空选择
      clearMultiSelection();
      setSelected(null);
    }
    downAt = null;
    downWorld = null;
    dragging = false;
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      if (rect) { rect.destroy(); rect = null; layers.ui.batchDraw(); }
      clearMultiSelection();
      setSelected(null);
      downAt = null; dragging = false;
    }
  };

  // 多选拖动结束（统一）
  // marquee 模式下也支持单选对象拖动后写回 state
  const onDragEnd = (e) => {
    if (state.multiSelectIds.length > 0) return;  // 多选有自己的 dragend
    if (!state.selectedId) return;
    let n = e.target;
    while (n && n.id() !== state.selectedId) n = n.getParent();
    if (!n) return;
    const obj = state.objects.find(o => o.id === state.selectedId);
    if (obj) {
      syncObjectFromNode(obj, n);
      pushHistory();
    }
  };

  stage.on('mousedown.marquee', onMouseDown);
  stage.on('mousemove.marquee', onMouseMove);
  stage.on('mouseup.marquee',   onMouseUp);
  stage.on('dragend.marquee',   onDragEnd);
  window.addEventListener('keydown', onKey);

  return () => {
    stage.off('mousedown.marquee mousemove.marquee mouseup.marquee dragend.marquee');
    window.removeEventListener('keydown', onKey);
    if (rect) { rect.destroy(); rect = null; layers.ui.batchDraw(); }
  };
}

/**
 * 找出所有 bbox 与 box 相交的对象 id
 */
function pickInBox(box) {
  const ids = [];
  for (const k of ['walls','openings','furniture','lights','annotations']) {
    layers[k].getChildren().forEach(node => {
      if (!node.id()) return;
      const r = node.getClientRect({ relativeTo: stage });
      // r 是 stage 坐标系（屏幕像素），需要转世界坐标
      const z = stage.scaleX();
      const x1 = (r.x - stage.x()) / z;
      const y1 = (r.y - stage.y()) / z;
      const x2 = x1 + r.width / z;
      const y2 = y1 + r.height / z;
      // 相交判定：两矩形重叠
      if (x2 < box.x1 || x1 > box.x2 || y2 < box.y1 || y1 > box.y2) return;
      ids.push(node.id());
    });
  }
  return ids;
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
