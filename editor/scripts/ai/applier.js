/**
 * 把 AI 返回的 actions 应用到 state
 *
 * 安全策略：
 *  - 所有 add 的对象都重新分配 id（忽略 AI 给的 id，防止冲突）
 *  - 校验 type / subtype 必须合法
 *  - 限制单批最大变更数（防止恶意/误生成大量对象）
 *  - 应用前 dry-run 一次，全部通过才提交
 *  - 应用后 pushHistory，方便用户撤销
 */
import { state, genId } from '../state.js';
import { renderAll } from '../renderer.js';
import { pushHistory } from '../history.js';
import { FURNITURE_SUBTYPES, LIGHT_SUBTYPES } from './prompts.js';

const MAX_ACTIONS_PER_BATCH = 200;
const VALID_TYPES = new Set(['wall', 'door', 'window', 'furniture', 'light', 'text', 'scale', 'compass', 'dimension']);
const FURN_SET = new Set(FURNITURE_SUBTYPES);
const LIGHT_SET = new Set(LIGHT_SUBTYPES);

/**
 * 校验 + 规范化单个对象（add 用）
 */
function validateAndNormalizeObject(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '对象为空' };
  const t = raw.type;
  if (!VALID_TYPES.has(t)) return { ok: false, error: `非法 type: ${t}` };

  const obj = { ...raw };

  // 强制重新分配 id
  obj.id = genId(t);

  // 数值字段防御
  const numFields = ['x', 'y', 'w', 'h', 'rotation', 'fontSize', 'totalCm', 'thickness'];
  for (const f of numFields) {
    if (obj[f] !== undefined) {
      const n = Number(obj[f]);
      if (Number.isFinite(n)) obj[f] = n;
      else delete obj[f];
    }
  }

  if (t === 'wall') {
    if (!Array.isArray(obj.points) || obj.points.length < 4) {
      return { ok: false, error: 'wall 缺少有效 points' };
    }
    obj.points = obj.points.slice(0, 1000).map(Number).filter(Number.isFinite);
    if (obj.points.length < 4) return { ok: false, error: 'wall points 不足' };
    if (obj.thickness === undefined) obj.thickness = 20;
  } else if (t === 'furniture') {
    if (!FURN_SET.has(obj.subtype)) return { ok: false, error: `家具子类型非法: ${obj.subtype}` };
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return { ok: false, error: '家具缺少 x/y' };
    if (!obj.w) obj.w = 100;
    if (!obj.h) obj.h = 60;
  } else if (t === 'light') {
    if (!LIGHT_SET.has(obj.subtype)) return { ok: false, error: `灯光子类型非法: ${obj.subtype}` };
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return { ok: false, error: '灯光缺少 x/y' };
  } else if (t === 'door' || t === 'window') {
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return { ok: false, error: `${t} 缺少 x/y` };
    if (!obj.w) obj.w = t === 'door' ? 90 : 120;
    if (!obj.h) obj.h = 20;
  } else if (t === 'text') {
    if (typeof obj.text !== 'string' || !obj.text.trim()) return { ok: false, error: 'text 内容为空' };
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return { ok: false, error: 'text 缺少 x/y' };
    if (!obj.fontSize) obj.fontSize = 24;
  } else if (t === 'scale' || t === 'compass') {
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return { ok: false, error: `${t} 缺少 x/y` };
  }

  // 限制坐标范围
  for (const f of ['x', 'y']) {
    if (typeof obj[f] === 'number' && Math.abs(obj[f]) > 50000) {
      return { ok: false, error: `${f} 超出范围` };
    }
  }

  return { ok: true, obj };
}

/**
 * Dry run + apply
 * @param {Array} actions
 * @returns {{applied:number, errors:string[]}}
 */
export function applyActions(actions) {
  if (!Array.isArray(actions)) return { applied: 0, errors: ['actions 不是数组'] };
  if (actions.length > MAX_ACTIONS_PER_BATCH) {
    return { applied: 0, errors: [`单次操作过多 (${actions.length} > ${MAX_ACTIONS_PER_BATCH})`] };
  }

  // ---- 1) Dry run ----
  const errors = [];
  const plans = [];
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (!a || !a.op) { errors.push(`#${i}: 缺少 op`); continue; }
    if (a.op === 'add') {
      const v = validateAndNormalizeObject(a.object);
      if (!v.ok) { errors.push(`#${i} add: ${v.error}`); continue; }
      plans.push({ op: 'add', obj: v.obj });
    } else if (a.op === 'update') {
      if (!a.id) { errors.push(`#${i} update: 缺少 id`); continue; }
      const target = state.objects.find(o => o.id === a.id);
      if (!target) { errors.push(`#${i} update: 找不到 id ${a.id}`); continue; }
      const patch = a.patch && typeof a.patch === 'object' ? a.patch : {};
      // 只允许这些字段被 patch
      const allow = ['x', 'y', 'w', 'h', 'rotation', 'label', 'text', 'fontSize', 'subtype', 'points', 'totalCm', 'thickness'];
      const safePatch = {};
      for (const k of allow) {
        if (k in patch) safePatch[k] = patch[k];
      }
      // subtype 校验
      if (safePatch.subtype) {
        if (target.type === 'furniture' && !FURN_SET.has(safePatch.subtype)) {
          errors.push(`#${i} update: 家具子类型非法 ${safePatch.subtype}`); continue;
        }
        if (target.type === 'light' && !LIGHT_SET.has(safePatch.subtype)) {
          errors.push(`#${i} update: 灯光子类型非法 ${safePatch.subtype}`); continue;
        }
      }
      plans.push({ op: 'update', id: a.id, patch: safePatch });
    } else if (a.op === 'delete') {
      if (!a.id) { errors.push(`#${i} delete: 缺少 id`); continue; }
      plans.push({ op: 'delete', id: a.id });
    } else if (a.op === 'clear') {
      plans.push({ op: 'clear' });
    } else {
      errors.push(`#${i}: 未知 op ${a.op}`);
    }
  }

  // 任何一条非法都 abort，不部分应用
  if (errors.length > 0) {
    return { applied: 0, errors };
  }

  // ---- 2) Apply ----
  let applied = 0;
  for (const p of plans) {
    if (p.op === 'add') {
      state.objects.push(p.obj);
      applied++;
    } else if (p.op === 'update') {
      const target = state.objects.find(o => o.id === p.id);
      if (target) {
        Object.assign(target, p.patch);
        applied++;
      }
    } else if (p.op === 'delete') {
      state.objects = state.objects.filter(o => o.id !== p.id);
      applied++;
    } else if (p.op === 'clear') {
      state.objects = [];
      applied++;
    }
  }

  if (applied > 0) {
    state.selectedId = null;
    state.multiSelectIds = [];
    pushHistory();
    renderAll();
  }

  return { applied, errors: [] };
}

/**
 * 描述一组 actions，给用户预览（中文）
 */
export function describeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return '无操作';
  const counts = { add: 0, update: 0, delete: 0, clear: 0 };
  const byType = {};
  for (const a of actions) {
    if (!a || !a.op) continue;
    if (a.op in counts) counts[a.op]++;
    if (a.op === 'add' && a.object?.type) {
      const k = a.object.subtype || a.object.type;
      byType[k] = (byType[k] || 0) + 1;
    }
  }
  const parts = [];
  if (counts.add)    parts.push(`新增 ${counts.add} 个对象`);
  if (counts.update) parts.push(`修改 ${counts.update} 个对象`);
  if (counts.delete) parts.push(`删除 ${counts.delete} 个对象`);
  if (counts.clear)  parts.push(`清空画布`);
  let s = parts.join('，');
  const detail = Object.entries(byType).map(([k, v]) => `${k}×${v}`).join(', ');
  if (detail) s += ` (${detail})`;
  return s;
}
