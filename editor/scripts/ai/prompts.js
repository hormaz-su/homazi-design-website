/**
 * Prompt 模板 + JSON Schema
 *
 * 设计思路：
 *  - 让 AI 输出严格的 JSON：{ reply: "中文解释", actions: [...] }
 *  - actions 是一组对画布的指令；每条 action 有 type 字段，可被 applier 安全应用
 *  - 给 AI 完整的家具/灯光子类型清单 + 当前画布摘要 + 坐标系约定
 */

// 子类型清单的唯一来源是 furniture.js 的 META；此处仅再导出，避免两份清单漂移。
export { FURNITURE_SUBTYPES, LIGHT_SUBTYPES } from '../furniture.js';
import { FURNITURE_SUBTYPES, LIGHT_SUBTYPES } from '../furniture.js';

/**
 * 构造系统提示词
 */
export function buildSystemPrompt() {
  return `你是 Homazi Floor Editor 的 AI 设计助手，帮助用户在网页 Canvas 上设计室内户型平面图。

## 坐标系
- 单位是厘米 (cm)
- 原点 (0,0) 在画布中心
- X 向右为正，Y 向下为正
- 标准住宅尺寸参考：客厅 400x500cm、主卧 350x400cm、次卧 300x350cm、厨房 250x350cm、卫生间 200x200cm

## 对象 Schema
所有对象有 id (string) 和 type (string)。各类型字段：

- 墙体 wall:    { id, type:"wall", points:[x1,y1,x2,y2], thickness?:20 }
- 门 door:      { id, type:"door", x, y, w?:90, h?:20, rotation?:0, hinge?:"left"|"right" }
- 窗 window:    { id, type:"window", x, y, w?:120, h?:20, rotation?:0 }
- 家具 furniture: { id, type:"furniture", subtype, x, y, w, h, rotation?:0, label? }
  · subtype 必须从这个列表选: ${FURNITURE_SUBTYPES.join(', ')}
- 灯光 light:   { id, type:"light", subtype, x, y, rotation?:0, label? }
  · subtype 必须从这个列表选: ${LIGHT_SUBTYPES.join(', ')}
- 文字 text:    { id, type:"text", x, y, text, fontSize?:24, rotation?:0 }
- 比例尺 scale: { id, type:"scale", x, y, totalCm?:500 }
- 指北针 compass: { id, type:"compass", x, y, rotation?:0 }

注：x,y 表示对象中心点；w,h 表示宽高 (cm)；rotation 单位为度（0/90/180/270 优先）。
家具的 w,h 不填会用默认值；强烈建议填入合理尺寸。

## 输出格式（严格）
你必须返回一个 JSON 对象，结构如下：

{
  "reply": "用中文向用户解释你做了什么 / 给的建议（150 字以内）",
  "actions": [
    {"op": "add",    "object": { ... 完整对象，不要写 id，由系统分配 ... }},
    {"op": "update", "id": "现有对象 id", "patch": { ... 要修改的字段 ... }},
    {"op": "delete", "id": "现有对象 id"},
    {"op": "clear"}  // 清空所有对象（慎用）
  ]
}

## 准则
1. 用户没明确要求修改时，actions 可以是 []；只在 reply 中给文字建议。
2. 生成布局时墙体先画一圈外墙，再内墙分隔；门窗放在墙上；家具放在房间中央或贴墙。
3. 灯光数量参考：客厅 4 筒灯+1 主灯；卧室 1 主灯+2 床头壁灯；厨房 2 筒灯；卫浴 1 防水灯。
4. 不要返回围栏外的任何文字；整个回复必须是单个有效 JSON 对象。
5. 不要在 reply 里复述大段坐标。
6. 物品之间避免重叠；家具与墙体留 5-10cm 间隙。
`;
}

/**
 * 把当前画布状态摘要成给 AI 的 user message 前缀
 */
export function summarizeCanvas(state) {
  const counts = {};
  for (const o of state.objects) {
    const k = o.subtype ? `${o.type}:${o.subtype}` : o.type;
    counts[k] = (counts[k] || 0) + 1;
  }

  // 选中对象的详情
  let selected = '';
  if (state.selectedId) {
    const obj = state.objects.find(o => o.id === state.selectedId);
    if (obj) {
      const compact = { ...obj };
      // 不传过长字段
      if (compact.points && compact.points.length > 4) {
        compact.points = `[${compact.points.length} 点折线]`;
      }
      selected = `\n## 当前选中\n${JSON.stringify(compact)}`;
    }
  }

  // bbox
  let bbox = null;
  for (const o of state.objects) {
    const px = o.x ?? (o.points?.[0]);
    const py = o.y ?? (o.points?.[1]);
    if (typeof px !== 'number' || typeof py !== 'number') continue;
    if (!bbox) bbox = { minX: px, maxX: px, minY: py, maxY: py };
    bbox.minX = Math.min(bbox.minX, px);
    bbox.maxX = Math.max(bbox.maxX, px);
    bbox.minY = Math.min(bbox.minY, py);
    bbox.maxY = Math.max(bbox.maxY, py);
  }

  const summary = `## 当前画布状态\n- 对象数: ${state.objects.length}\n- 类型分布: ${
    Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ') || '空'
  }${bbox ? `\n- 范围: x ${bbox.minX.toFixed(0)}~${bbox.maxX.toFixed(0)}, y ${bbox.minY.toFixed(0)}~${bbox.maxY.toFixed(0)} cm` : ''}${selected}`;

  return summary;
}

/**
 * 给 AI 用的「现有对象 id 清单」，让它知道能引用哪些 id 做 update/delete
 * 仅在用户问题涉及修改/解释现有内容时才需要
 */
export function listObjectIds(state, limit = 50) {
  const list = state.objects.slice(0, limit).map(o => {
    const tag = o.subtype || o.type;
    const pos = (typeof o.x === 'number') ? ` @(${o.x.toFixed(0)},${o.y.toFixed(0)})` : '';
    const lbl = o.label ? ` "${o.label}"` : (o.text ? ` "${o.text.slice(0, 10)}"` : '');
    return `${o.id} [${tag}]${lbl}${pos}`;
  });
  return list.length ? `\n## 现有对象 id 清单\n${list.join('\n')}` : '';
}

/**
 * 快捷指令模板
 */
export const QUICK_PROMPTS = [
  { label: '✨ 生成布局', prompt: '帮我生成一个 80 平米两室一厅的标准布局，包括墙体、门窗、所有必要家具和灯光。' },
  { label: '💡 加灯光',   prompt: '为当前所有房间补上合理的灯光方案：客厅主灯+筒灯、卧室主灯+床头壁灯、厨卫筒灯。' },
  { label: '🎨 优化',     prompt: '检查当前布局的合理性（动线、采光、家具间距），列出问题并给出修改建议。如果能直接调整就直接调整。' },
  { label: '🔍 解释',     prompt: '简要解释一下当前画布上有什么内容、整体布局是什么样的。' },
];
