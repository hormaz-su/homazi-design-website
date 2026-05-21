/**
 * 主题管理：白天 ↔ 黑夜
 * - 切换 <html data-theme>
 * - 通知 stage 重绘画布元素颜色
 */
import { state, emit } from './state.js';

export function getTheme() { return state.theme; }

export function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  emit('theme:change', theme);
}

export function toggleTheme() {
  setTheme(state.theme === 'day' ? 'night' : 'day');
}

/**
 * 读取当前主题下的画布颜色（从 CSS 变量）
 */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k) => cs.getPropertyValue(k).trim();
  return {
    canvasBg:        v('--canvas-bg'),
    grid:            v('--canvas-grid'),
    gridMajor:       v('--canvas-grid-major'),
    wallFill:        v('--wall-fill'),
    wallStroke:      v('--wall-stroke'),
    furnitureFill:   v('--furniture-fill'),
    furnitureStroke: v('--furniture-stroke'),
    furnitureDetail: v('--furniture-detail'),
    lightColor:      v('--light-color'),
    lightGlow:       v('--light-glow'),
    textCanvas:      v('--text-canvas'),
    textCanvasSec:   v('--text-canvas-secondary'),
    doorArc:         v('--door-arc'),
    windowFill:      v('--window-fill'),
    selection:       v('--selection'),
    isNight:         state.theme === 'night',
  };
}
