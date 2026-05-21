/**
 * 撤销 / 重做 / 自动保存（localStorage）
 */
import { state } from './state.js';
import { renderAll } from './renderer.js';

const STORAGE_KEY = 'homazi-floor-editor:autosave-v1';
const HISTORY_LIMIT = 50;

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
      state.objects = data.objects;
      // 重置历史
      state.history = [JSON.stringify(state.objects)];
      state.historyIndex = 0;
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
}

export function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.objects)) throw new Error('文件格式错误');
      state.objects = data.objects;
      state.selectedId = null;
      state.history = [JSON.stringify(state.objects)];
      state.historyIndex = 0;
      renderAll();
      autoSave();
    } catch (err) {
      alert('加载失败：' + err.message);
    }
  };
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
}
