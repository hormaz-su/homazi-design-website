/**
 * Konva 舞台：网格、图层管理、缩放平移、坐标转换
 */
import { state, subscribe, emit } from './state.js';
import { themeColors } from './theme.js';

export const layers = {
  grid: null,
  walls: null,
  openings: null,    // 门窗
  furniture: null,
  lights: null,
  annotations: null,
  ui: null,          // 选中框、辅助线、绘制中临时图形
};

export let stage = null;
let gridGroup = null;

export function initStage(containerId) {
  const container = document.getElementById(containerId);
  const { offsetWidth: w, offsetHeight: h } = container;

  stage = new Konva.Stage({
    container: containerId,
    width: w,
    height: h,
    draggable: false,  // 用空格或中键平移
  });

  // 创建图层（顺序决定 z-index）
  layers.grid        = new Konva.Layer({ listening: false });
  layers.walls       = new Konva.Layer();
  layers.openings    = new Konva.Layer();
  layers.furniture   = new Konva.Layer();
  layers.lights      = new Konva.Layer();
  layers.annotations = new Konva.Layer();
  layers.ui          = new Konva.Layer();

  Object.values(layers).forEach(l => stage.add(l));

  drawGrid();
  bindZoomPan();
  bindResize(container);

  // 主题切换：重绘网格 + 让对象重读颜色
  subscribe((event) => {
    if (event === 'theme:change') {
      drawGrid();
      emit('canvas:rerender');
    }
  });

  return stage;
}

/**
 * 绘制网格背景
 * 主网格 = gridSize cm（默认 50cm），次网格 = 10cm
 * 实际像素 = cm * scale * zoom，但网格本身放在 grid 层、不参与缩放变换
 * 简化：用 stage 的 transform 统一缩放，网格在 cm 坐标系画
 */
function drawGrid() {
  layers.grid.destroyChildren();
  const c = themeColors();

  // 大背景矩形（无限延展感：用 stage 当前可视区扩展 5 倍）
  const bg = new Konva.Rect({
    x: -10000, y: -10000,
    width: 20000, height: 20000,
    fill: c.canvasBg,
    listening: false,
  });
  layers.grid.add(bg);

  // 网格线：在 cm 坐标系下绘制
  const minorStep = 10;       // 10cm
  const majorStep = 50;       // 50cm
  const range = 4000;         // ±4000 cm = 80m 见方足够
  const half = range / 2;

  // 次网格
  for (let x = -half; x <= half; x += minorStep) {
    const isMajor = x % majorStep === 0;
    layers.grid.add(new Konva.Line({
      points: [x, -half, x, half],
      stroke: isMajor ? c.gridMajor : c.grid,
      strokeWidth: isMajor ? 0.6 : 0.3,
      listening: false,
    }));
  }
  for (let y = -half; y <= half; y += minorStep) {
    const isMajor = y % majorStep === 0;
    layers.grid.add(new Konva.Line({
      points: [-half, y, half, y],
      stroke: isMajor ? c.gridMajor : c.grid,
      strokeWidth: isMajor ? 0.6 : 0.3,
      listening: false,
    }));
  }

  // 中心十字标记（原点）
  layers.grid.add(new Konva.Line({
    points: [-15, 0, 15, 0],
    stroke: c.gridMajor, strokeWidth: 1.2, listening: false,
  }));
  layers.grid.add(new Konva.Line({
    points: [0, -15, 0, 15],
    stroke: c.gridMajor, strokeWidth: 1.2, listening: false,
  }));

  layers.grid.batchDraw();
}

/**
 * 缩放（鼠标滚轮）& 平移（空格+拖拽 / 中键拖拽）
 */
function bindZoomPan() {
  // 初始视图：把原点放在画布中心，缩放为 scale（1cm = 5px）
  applyView({ zoom: state.scale, panX: stage.width() / 2, panY: stage.height() / 2 });

  // 鼠标滚轮缩放
  stage.on('wheel', (e) => {
    e.evt.preventDefault();
    const oldZoom = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldZoom,
      y: (pointer.y - stage.y()) / oldZoom,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    let newZoom = direction > 0 ? oldZoom * factor : oldZoom / factor;
    newZoom = Math.max(0.5, Math.min(40, newZoom));
    const newPos = {
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
    };
    applyView({ zoom: newZoom, panX: newPos.x, panY: newPos.y });
    updateZoomDisplay();
  });

  // 空格 + 拖拽 平移
  let isPanning = false;
  let isSpaceDown = false;
  let lastPos = null;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpaceDown) {
      isSpaceDown = true;
      stage.container().style.cursor = 'grab';
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isSpaceDown = false;
      isPanning = false;
      stage.container().style.cursor = '';
    }
  });
  stage.on('mousedown', (e) => {
    // 中键 或 空格+左键
    if (e.evt.button === 1 || (isSpaceDown && e.evt.button === 0)) {
      isPanning = true;
      lastPos = { x: e.evt.clientX, y: e.evt.clientY };
      stage.container().style.cursor = 'grabbing';
      e.evt.preventDefault();
    }
  });
  stage.on('mousemove', (e) => {
    if (!isPanning) return;
    const dx = e.evt.clientX - lastPos.x;
    const dy = e.evt.clientY - lastPos.y;
    lastPos = { x: e.evt.clientX, y: e.evt.clientY };
    stage.position({ x: stage.x() + dx, y: stage.y() + dy });
    stage.batchDraw();
  });
  stage.on('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      stage.container().style.cursor = isSpaceDown ? 'grab' : '';
    }
  });
}

export function applyView({ zoom, panX, panY }) {
  if (zoom !== undefined) {
    stage.scale({ x: zoom, y: zoom });
    state.zoom = zoom;
  }
  if (panX !== undefined && panY !== undefined) {
    stage.position({ x: panX, y: panY });
    state.panX = panX;
    state.panY = panY;
  }
  stage.batchDraw();
}

export function resetView() {
  applyView({
    zoom: state.scale,
    panX: stage.width() / 2,
    panY: stage.height() / 2,
  });
  updateZoomDisplay();
}

export function zoomBy(factor) {
  const oldZoom = stage.scaleX();
  let newZoom = oldZoom * factor;
  newZoom = Math.max(0.5, Math.min(40, newZoom));
  // 围绕画布中心缩放
  const cx = stage.width() / 2;
  const cy = stage.height() / 2;
  const mousePointTo = {
    x: (cx - stage.x()) / oldZoom,
    y: (cy - stage.y()) / oldZoom,
  };
  applyView({
    zoom: newZoom,
    panX: cx - mousePointTo.x * newZoom,
    panY: cy - mousePointTo.y * newZoom,
  });
  updateZoomDisplay();
}

export function updateZoomDisplay() {
  const el = document.getElementById('zoomLevel');
  if (el) {
    // 100% = 1cm 显示为 scale 像素（即 zoom == state.scale）
    const pct = Math.round((stage.scaleX() / state.scale) * 100);
    el.textContent = pct + '%';
  }
}

/**
 * 把屏幕坐标转换为画布逻辑坐标（cm）
 */
export function screenToWorld(screenX, screenY) {
  const z = stage.scaleX();
  return {
    x: (screenX - stage.x()) / z,
    y: (screenY - stage.y()) / z,
  };
}

/**
 * 获取舞台指针的世界坐标
 */
export function getPointerWorld() {
  const p = stage.getPointerPosition();
  if (!p) return null;
  return screenToWorld(p.x, p.y);
}

function bindResize(container) {
  const ro = new ResizeObserver(() => {
    stage.width(container.offsetWidth);
    stage.height(container.offsetHeight);
    stage.batchDraw();
  });
  ro.observe(container);
}
