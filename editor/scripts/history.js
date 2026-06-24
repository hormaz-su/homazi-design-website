/**
 * 撤销 / 重做 / 自动保存（localStorage）
 */
import { state, genId } from './state.js';
import { renderAll } from './renderer.js';
import { toast } from './toast.js';

const STORAGE_KEY = 'homazi-floor-editor:autosave-v1';
const HISTORY_LIMIT = 50;

const VALID_TYPES = new Set([
  'wall', 'door', 'window', 'furniture', 'light', 'text', 'scale', 'compass', 'dimension',
]);

/**
 * 清洗外部来源（导入文件 / localStorage）的对象数组：
 * 不信任任何字段——丢弃结构非法的对象，补全缺失 id，避免渲染时崩溃。
 * @returns {{objects: Array, dropped: number}}
 */
function sanitizeObjects(arr) {
  if (!Array.isArray(arr)) return { objects: [], dropped: 0 };
  const out = [];
  let dropped = 0;
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object' || !VALID_TYPES.has(raw.type)) { dropped++; continue; }
    // 墙体必须有合法 points；其余类型必须有数值 x/y
    if (raw.type === 'wall') {
      if (!Array.isArray(raw.points) || raw.points.length < 4
          || !raw.points.slice(0, 4).every(n => Number.isFinite(Number(n)))) { dropped++; continue; }
    } else if (!Number.isFinite(Number(raw.x)) || !Number.isFinite(Number(raw.y))) {
      dropped++; continue;
    }
    const obj = { ...raw };
    if (typeof obj.id !== 'string' || !obj.id) obj.id = genId(obj.type);
    out.push(obj);
  }
  return { objects: out, dropped };
}

export function pushHistory() {
  // 截断 redo 部分
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(JSON.stringify(state.objects));
  if (state.history.length > HISTORY_LIMIT) {
    state.history.shift();
  } else {
    state.historyIndex++;
  }
  autoSave();
}

export function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex--;
  state.objects = JSON.parse(state.history[state.historyIndex]);
  state.selectedId = null;
  renderAll();
  autoSave();
}

export function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex++;
  state.objects = JSON.parse(state.history[state.historyIndex]);
  state.selectedId = null;
  renderAll();
  autoSave();
}

export function autoSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      theme: state.theme,
      objects: state.objects,
      savedAt: Date.now(),
    }));
  } catch (e) {
    console.warn('自动保存失败', e);
  }
}

export function loadAutoSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.objects) {
      const { objects, dropped } = sanitizeObjects(data.objects);
      state.objects = objects;
      // 重置历史
      state.history = [JSON.stringify(state.objects)];
      state.historyIndex = 0;
      if (dropped > 0) toast(`已恢复上次设计，忽略 ${dropped} 个损坏对象`, 'warn');
      return true;
    }
  } catch (e) {
    console.warn('加载自动保存失败', e);
  }
  return false;
}

export function newDocument() {
  if (state.objects.length > 0) {
    if (!confirm('确定要新建？当前未保存的内容将丢失。')) return false;
  }
  state.objects = [];
  state.selectedId = null;
  state.history = [JSON.stringify([])];
  state.historyIndex = 0;
  renderAll();
  autoSave();
  return true;
}

export function exportJSON() {
  const data = {
    version: 1,
    theme: state.theme,
    objects: state.objects,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `floor-plan-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('已导出 JSON 文件', 'success');
}

export function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !Array.isArray(data.objects)) throw new Error('文件格式错误：缺少 objects 数组');
      const { objects, dropped } = sanitizeObjects(data.objects);
      state.objects = objects;
      state.selectedId = null;
      state.history = [JSON.stringify(state.objects)];
      state.historyIndex = 0;
      renderAll();
      autoSave();
      if (dropped > 0) toast(`已加载 ${objects.length} 个对象，忽略 ${dropped} 个无效对象`, 'warn');
      else toast(`已加载 ${objects.length} 个对象`, 'success');
    } catch (err) {
      toast('加载失败：' + err.message, 'error');
    }
  };
  reader.onerror = () => toast('读取文件失败', 'error');
  reader.readAsText(file);
}

export function exportPNG(stage) {
  // 临时把视图复位到能看到所有内容的 bounding box
  const dataURL = stage.toDataURL({
    pixelRatio: 2,
    mimeType: 'image/png',
  });
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = `floor-plan-${Date.now()}.png`;
  a.click();
  toast('已导出 PNG 图片', 'success');
}
