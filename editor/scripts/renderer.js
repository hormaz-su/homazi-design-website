/**
 * 渲染器：根据 state.objects 同步 Konva 图形
 * 主题切换 / 对象增删改后调用 renderAll() 即可
 */
import { state, subscribe } from './state.js';
import { layers } from './stage.js';
import { themeColors } from './theme.js';
import { buildFurniture, buildLight } from './furniture.js';

export function renderAll() {
  // 清空所有内容图层
  ['walls', 'openings', 'furniture', 'lights', 'annotations'].forEach(k => {
    layers[k].destroyChildren();
  });

  state.objects.forEach(obj => renderObject(obj));

  Object.values(layers).forEach(l => l.batchDraw());
  updateLayerCounts();
}

export function renderObject(obj) {
  let node = null;
  switch (obj.type) {
    case 'wall':       node = buildWall(obj);       layers.walls.add(node);       break;
    case 'door':       node = buildDoor(obj);       layers.openings.add(node);    break;
    case 'window':     node = buildWindow(obj);     layers.openings.add(node);    break;
    case 'furniture':  node = buildFurniture(obj);  layers.furniture.add(node);   break;
    case 'light':      node = buildLight(obj);      layers.lights.add(node);      break;
    case 'text':       node = buildText(obj);       layers.annotations.add(node); break;
    case 'dimension':  node = buildDimension(obj);  layers.annotations.add(node); break;
    case 'compass':    node = buildCompass(obj);    layers.annotations.add(node); break;
    case 'scale':      node = buildScaleBar(obj);   layers.annotations.add(node); break;
    default: return null;
  }
  return node;
}

export function findNodeById(id) {
  for (const layer of Object.values(layers)) {
    const node = layer.findOne(`#${id}`);
    if (node) return node;
  }
  return null;
}

/* ===== 墙体 ===== */
function buildWall(obj) {
  const c = themeColors();
  const thick = obj.thickness ?? 20; // 默认 20cm
  // 用粗线段表示墙
  return new Konva.Line({
    id: obj.id,
    points: obj.points,  // [x1,y1,x2,y2]
    stroke: c.wallFill,
    strokeWidth: thick,
    lineCap: 'butt',
    name: 'wall',
    hitStrokeWidth: thick + 6,
  });
}

/* ===== 门：80cm 宽 + 90° 开启弧线 ===== */
function buildDoor(obj) {
  const c = themeColors();
  const w = obj.w ?? 80;
  const g = new Konva.Group({
    id: obj.id, x: obj.x, y: obj.y,
    rotation: obj.rotation || 0,
    draggable: true,
    name: 'door-group',
  });
  // 门洞底线
  g.add(new Konva.Line({ points: [0, 0, w, 0], stroke: c.canvasBg, strokeWidth: 22 }));
  // 门板
  g.add(new Konva.Rect({ x: 0, y: -3, width: w, height: 3, fill: c.doorArc }));
  // 90° 开启弧
  g.add(new Konva.Arc({
    x: 0, y: 0,
    innerRadius: w, outerRadius: w,
    angle: 90, rotation: -90,
    stroke: c.doorArc, strokeWidth: 0.8,
    dash: [3, 2],
  }));
  // 开门方向板
  g.add(new Konva.Line({ points: [0, 0, 0, -w], stroke: c.doorArc, strokeWidth: 1.5 }));
  return g;
}

/* ===== 窗：120cm 宽，双线 ===== */
function buildWindow(obj) {
  const c = themeColors();
  const w = obj.w ?? 120;
  const g = new Konva.Group({
    id: obj.id, x: obj.x, y: obj.y,
    rotation: obj.rotation || 0,
    draggable: true,
    name: 'window-group',
  });
  g.add(new Konva.Rect({ x: 0, y: -10, width: w, height: 20, fill: c.canvasBg }));
  g.add(new Konva.Line({ points: [0, -8, w, -8], stroke: c.windowFill, strokeWidth: 1.2 }));
  g.add(new Konva.Line({ points: [0, 0, w, 0], stroke: c.windowFill, strokeWidth: 0.8 }));
  g.add(new Konva.Line({ points: [0, 8, w, 8], stroke: c.windowFill, strokeWidth: 1.2 }));
  return g;
}

/* ===== 文字标注 ===== */
function buildText(obj) {
  const c = themeColors();
  return new Konva.Text({
    id: obj.id,
    x: obj.x, y: obj.y,
    text: obj.text || '文字',
    fontSize: obj.fontSize || 16,
    fontFamily: '-apple-system, "PingFang SC", sans-serif',
    fontStyle: obj.bold ? 'bold' : 'normal',
    fill: c.textCanvas,
    rotation: obj.rotation || 0,
    draggable: true,
    name: 'text-group',
  });
}

/* ===== 尺寸标注 ===== */
function buildDimension(obj) {
  const c = themeColors();
  const [x1, y1, x2, y2] = obj.points;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const text = obj.text || `${Math.round(len)} cm`;

  const g = new Konva.Group({
    id: obj.id,
    x: x1, y: y1,
    rotation: angle,
    draggable: true,
    name: 'dimension-group',
  });
  // 主线
  g.add(new Konva.Line({ points: [0, 0, len, 0], stroke: c.textCanvasSec, strokeWidth: 0.8 }));
  // 端点小竖线
  g.add(new Konva.Line({ points: [0, -4, 0, 4], stroke: c.textCanvasSec, strokeWidth: 0.8 }));
  g.add(new Konva.Line({ points: [len, -4, len, 4], stroke: c.textCanvasSec, strokeWidth: 0.8 }));
  // 标签
  g.add(new Konva.Text({
    x: len / 2 - 30, y: -16, width: 60,
    text, fontSize: 11, align: 'center',
    fill: c.textCanvas,
  }));
  return g;
}

/* ===== 指北针 ===== */
function buildCompass(obj) {
  const c = themeColors();
  const r = 30;
  const g = new Konva.Group({
    id: obj.id,
    x: obj.x, y: obj.y,
    rotation: obj.rotation || 0,
    draggable: true,
    name: 'compass-group',
  });
  g.add(new Konva.Circle({ radius: r, stroke: c.textCanvas, strokeWidth: 1 }));
  // N 箭头
  g.add(new Konva.Line({
    points: [0, -r + 4, -r * 0.25, r * 0.5, 0, r * 0.2, r * 0.25, r * 0.5],
    closed: true, fill: c.textCanvas,
  }));
  g.add(new Konva.Text({
    x: -8, y: -r - 16, width: 16, text: 'N',
    fontSize: 14, align: 'center', fill: c.textCanvas, fontStyle: 'bold',
  }));
  return g;
}

/* ===== 比例尺 ===== */
function buildScaleBar(obj) {
  const c = themeColors();
  const totalCm = obj.totalCm ?? 500; // 5m
  const segments = 5;
  const segCm = totalCm / segments;
  const g = new Konva.Group({
    id: obj.id, x: obj.x, y: obj.y,
    draggable: true,
    name: 'scale-group',
  });
  for (let i = 0; i < segments; i++) {
    g.add(new Konva.Rect({
      x: i * segCm, y: 0, width: segCm, height: 6,
      fill: i % 2 === 0 ? c.textCanvas : c.canvasBg,
      stroke: c.textCanvas, strokeWidth: 0.6,
    }));
  }
  // 刻度文字
  for (let i = 0; i <= segments; i++) {
    g.add(new Konva.Text({
      x: i * segCm - 15, y: 10, width: 30,
      text: `${(i * segCm / 100).toFixed(1)}m`,
      fontSize: 9, align: 'center', fill: c.textCanvasSec,
    }));
  }
  return g;
}

/* ===== 图层计数（侧栏） ===== */
function updateLayerCounts() {
  const counts = { wall: 0, opening: 0, furniture: 0, light: 0, annotation: 0 };
  state.objects.forEach(o => {
    if (o.type === 'wall') counts.wall++;
    else if (o.type === 'door' || o.type === 'window') counts.opening++;
    else if (o.type === 'furniture') counts.furniture++;
    else if (o.type === 'light') counts.light++;
    else counts.annotation++;
  });
  const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
  set('countWalls', counts.wall);
  set('countOpenings', counts.opening);
  set('countFurniture', counts.furniture);
  set('countLights', counts.light);
  set('countAnnotations', counts.annotation);
}

// 主题切换或显式 rerender 时全量重绘
subscribe((event) => {
  if (event === 'canvas:rerender') renderAll();
});
