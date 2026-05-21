/**
 * 全局应用状态
 * 所有模块共享单例
 */
export const state = {
  // 主题
  theme: 'day',  // 'day' | 'night'

  // 当前工具
  tool: 'select',  // select | wall | door | window | text | dimension | scale | compass | delete

  // 比例尺：1cm = N px（默认 5）
  scale: 5,

  // 网格尺寸（cm）
  gridSize: 50,  // 主网格 50cm，次网格 10cm

  // 视图变换
  zoom: 1,
  panX: 0,
  panY: 0,

  // 数据：所有对象
  // 每个对象: { id, type, ...props }
  objects: [],

  // 选中对象 id
  selectedId: null,

  // 撤销/重做栈
  history: [],
  historyIndex: -1,

  // 临时绘制状态（如墙体折线）
  drafting: null,
};

let listeners = [];

export function subscribe(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(f => f !== fn); };
}

export function emit(event, payload) {
  listeners.forEach(fn => fn(event, payload));
}

let nextId = 1;
export function genId(prefix = 'obj') {
  return `${prefix}_${Date.now().toString(36)}_${nextId++}`;
}
