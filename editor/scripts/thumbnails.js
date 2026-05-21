/**
 * 素材库缩略图生成器
 *
 * 策略：在隐藏的离屏 Konva 舞台里，用与画布相同的 builder 画出每个家具/灯光，
 * 缩放到 thumbnail 尺寸，导出 dataURL，再设为 .lib-item 的背景。
 *
 * 这样 1) 缩略图与实际画布完全一致；2) 自动跟随主题切换重绘。
 */
import { FURNITURE_META, LIGHT_META, buildFurniture, buildLight } from './furniture.js';
import { genId, subscribe } from './state.js';

const THUMB_W = 88;   // 缩略图宽（px）
const THUMB_H = 56;   // 缩略图高（px）
const PAD = 6;        // 内边距

let offscreenStage = null;
let offscreenLayer = null;
let offscreenContainer = null;

function ensureOffscreen() {
  if (offscreenStage) return;
  offscreenContainer = document.createElement('div');
  offscreenContainer.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:200px;height:200px;';
  document.body.appendChild(offscreenContainer);
  offscreenStage = new Konva.Stage({
    container: offscreenContainer,
    width: 200,
    height: 200,
  });
  offscreenLayer = new Konva.Layer({ listening: false });
  offscreenStage.add(offscreenLayer);
}

/**
 * 生成单个家具的 dataURL
 */
function buildFurnitureThumb(subtype) {
  const meta = FURNITURE_META[subtype];
  if (!meta) return null;

  ensureOffscreen();
  offscreenLayer.destroyChildren();

  const { w, h } = meta;
  // 计算缩放：让家具铺满 thumbnail 区域
  const availW = THUMB_W - PAD * 2;
  const availH = THUMB_H - PAD * 2;
  const scale = Math.min(availW / w, availH / h);

  const obj = {
    id: genId('thumb'),
    type: 'furniture',
    subtype,
    x: w / 2,    // 因为 baseGroup 用了 offset center，对象绘制中心在 (x,y)
    y: h / 2,
    w, h,
    rotation: 0,
    label: meta.label,
  };
  const group = buildFurniture(obj);
  group.scale({ x: scale, y: scale });
  // 平移到 thumbnail 中心
  group.position({
    x: THUMB_W / 2,
    y: THUMB_H / 2,
  });
  // 关闭交互（draggable）以便快速渲染
  group.draggable(false);
  offscreenLayer.add(group);
  offscreenLayer.draw();

  return offscreenStage.toDataURL({
    x: 0, y: 0,
    width: THUMB_W,
    height: THUMB_H,
    pixelRatio: 2,
  });
}

/**
 * 生成单个灯光的 dataURL
 */
function buildLightThumb(subtype) {
  ensureOffscreen();
  offscreenLayer.destroyChildren();

  // 灯光默认 radius ~10cm，把它放大到约 28px 占据 thumbnail
  const targetSize = Math.min(THUMB_W, THUMB_H) - PAD * 2;
  const sourceR = LIGHT_META[subtype]?.radius ?? 10;
  // 灯光夜间模式光晕半径 = r*4，所以总占用 8r。让 8r 对应 targetSize
  const scale = targetSize / (sourceR * 8);

  const obj = {
    id: genId('thumb'),
    type: 'light',
    subtype,
    x: 0, y: 0,
    rotation: 0,
  };
  const group = buildLight(obj);
  group.scale({ x: scale, y: scale });
  group.position({ x: THUMB_W / 2, y: THUMB_H / 2 });
  group.draggable(false);
  offscreenLayer.add(group);
  offscreenLayer.draw();

  return offscreenStage.toDataURL({
    x: 0, y: 0,
    width: THUMB_W,
    height: THUMB_H,
    pixelRatio: 2,
  });
}

/**
 * 渲染所有素材库项的缩略图
 */
export function renderLibraryThumbnails() {
  document.querySelectorAll('.lib-item[data-furniture]').forEach(el => {
    const subtype = el.dataset.furniture;
    const url = buildFurnitureThumb(subtype);
    if (url) el.style.setProperty('--thumb', `url(${url})`);
  });
  document.querySelectorAll('.lib-item[data-light]').forEach(el => {
    const subtype = el.dataset.light;
    const url = buildLightThumb(subtype);
    if (url) el.style.setProperty('--thumb', `url(${url})`);
  });
}

// 主题切换时重绘所有缩略图（家具颜色会变）
subscribe((event) => {
  if (event === 'theme:change') {
    // 等下一帧，让 CSS 变量先更新
    requestAnimationFrame(() => renderLibraryThumbnails());
  }
});
