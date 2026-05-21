/**
 * 家具与灯光的图形定义库
 * 每个家具是一个工厂函数，输入 (cm 尺寸 + 主题颜色) → Konva.Group
 *
 * 所有家具默认锚点在中心，便于旋转。
 * 单位：cm（与 stage 一致）
 */
import { themeColors } from './theme.js';

/* ============ 家具元数据：默认尺寸 (cm) ============ */
export const FURNITURE_META = {
  'sofa-3':         { w: 220, h: 90,  label: '三人沙发', kind: 'furniture' },
  'sofa-l':         { w: 240, h: 180, label: 'L形沙发',  kind: 'furniture' },
  'armchair':       { w: 80,  h: 80,  label: '单人椅',   kind: 'furniture' },
  'coffee-table':   { w: 120, h: 60,  label: '茶几',     kind: 'furniture' },
  'tv-stand':       { w: 180, h: 40,  label: '电视柜',   kind: 'furniture' },
  'bed-double':     { w: 180, h: 200, label: '双人床',   kind: 'furniture' },
  'bed-single':     { w: 100, h: 200, label: '单人床',   kind: 'furniture' },
  'nightstand':     { w: 50,  h: 40,  label: '床头柜',   kind: 'furniture' },
  'wardrobe':       { w: 200, h: 60,  label: '衣柜',     kind: 'furniture' },
  'desk':           { w: 120, h: 60,  label: '书桌',     kind: 'furniture' },
  'dining-table':   { w: 180, h: 90,  label: '餐桌',     kind: 'furniture' },
  'kitchen-counter':{ w: 240, h: 60,  label: '操作台',   kind: 'furniture' },
  'stove':          { w: 60,  h: 60,  label: '灶台',     kind: 'furniture' },
  'sink':           { w: 80,  h: 50,  label: '水槽',     kind: 'furniture' },
  'fridge':         { w: 70,  h: 70,  label: '冰箱',     kind: 'furniture' },
  'toilet':         { w: 40,  h: 65,  label: '马桶',     kind: 'furniture' },
  'basin':          { w: 60,  h: 45,  label: '洗手盆',   kind: 'furniture' },
  'shower':         { w: 90,  h: 90,  label: '淋浴',     kind: 'furniture' },
  'bathtub':        { w: 170, h: 80,  label: '浴缸',     kind: 'furniture' },
};

export const LIGHT_META = {
  'downlight':      { label: '筒灯',    radius: 8 },
  'pendant':        { label: '吊灯',    radius: 12 },
  'chandelier':     { label: '线性吊灯', radius: 14 },
  'strip':          { label: '灯带',    radius: 14 },
  'sconce':         { label: '壁灯',    radius: 10 },
  'bath-light':     { label: '卫浴灯',  radius: 9 },
  'balcony-light':  { label: '阳台灯',  radius: 11 },
};

/* ============ 家具构造器 ============ */

function baseGroup(obj, c) {
  const { w, h } = obj;
  return new Konva.Group({
    id: obj.id,
    x: obj.x, y: obj.y,
    rotation: obj.rotation || 0,
    draggable: true,
    offsetX: w / 2,
    offsetY: h / 2,
    name: 'furniture-group',
  });
}

function rect(x, y, w, h, c, opts = {}) {
  return new Konva.Rect({
    x, y, width: w, height: h,
    fill: opts.fill ?? c.furnitureFill,
    stroke: opts.stroke ?? c.furnitureStroke,
    strokeWidth: opts.strokeWidth ?? 1,
    cornerRadius: opts.cornerRadius ?? 0,
  });
}
function line(points, c, opts = {}) {
  return new Konva.Line({
    points,
    stroke: opts.stroke ?? c.furnitureDetail,
    strokeWidth: opts.strokeWidth ?? 0.8,
    lineCap: 'round',
  });
}

const builders = {
  'sofa-3': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { cornerRadius: 8 }));
    // 靠背
    g.add(rect(0, 0, w, h * 0.25, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 6 }));
    // 坐垫分隔
    for (let i = 1; i < 3; i++) {
      g.add(line([w / 3 * i, h * 0.25, w / 3 * i, h - 4], c));
    }
    // 扶手
    g.add(rect(0, h * 0.25, w * 0.05, h * 0.75, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 4 }));
    g.add(rect(w * 0.95, h * 0.25, w * 0.05, h * 0.75, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 4 }));
    return g;
  },

  'sofa-l': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    // L 形：长边 + 短边
    const longW = w, longH = 90;
    const shortW = 90, shortH = h;
    g.add(rect(0, h - longH, longW, longH, c, { cornerRadius: 8 }));
    g.add(rect(w - shortW, 0, shortW, shortH - 30, c, { cornerRadius: 8 }));
    // 靠背
    g.add(rect(0, h - longH, longW - shortW, 22, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 4 }));
    g.add(rect(w - 22, 0, 22, shortH - 30, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 4 }));
    return g;
  },

  'armchair': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { cornerRadius: 10 }));
    g.add(rect(0, 0, w, h * 0.3, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 6 }));
    g.add(rect(0, h * 0.3, w * 0.12, h * 0.7, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 4 }));
    g.add(rect(w * 0.88, h * 0.3, w * 0.12, h * 0.7, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 4 }));
    return g;
  },

  'coffee-table': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { cornerRadius: 4 }));
    g.add(rect(6, 6, w - 12, h - 12, c, { fill: 'transparent', stroke: c.furnitureDetail, strokeWidth: 0.6 }));
    return g;
  },

  'tv-stand': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { cornerRadius: 2 }));
    // 抽屉分隔
    g.add(line([w / 3, 0, w / 3, h], c));
    g.add(line([(w / 3) * 2, 0, (w / 3) * 2, h], c));
    return g;
  },

  'bed-double': (obj, c) => buildBed(obj, c, true),
  'bed-single': (obj, c) => buildBed(obj, c, false),

  'nightstand': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { cornerRadius: 2 }));
    g.add(line([4, h / 2, w - 4, h / 2], c));
    return g;
  },

  'wardrobe': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 2 }));
    // 门分隔
    const doors = Math.max(2, Math.round(w / 60));
    for (let i = 1; i < doors; i++) {
      g.add(line([(w / doors) * i, 0, (w / doors) * i, h], c, { stroke: c.furnitureStroke, strokeWidth: 0.6 }));
    }
    return g;
  },

  'desk': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { cornerRadius: 3 }));
    g.add(rect(w - 50, 4, 46, h - 8, c, { fill: 'transparent', stroke: c.furnitureDetail, strokeWidth: 0.6 }));
    return g;
  },

  'dining-table': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    // 桌面
    g.add(rect(20, 10, w - 40, h - 20, c, { cornerRadius: 4 }));
    // 椅子（每边 2 把）
    const chairs = 6;
    for (let i = 0; i < 3; i++) {
      const cx = 30 + (w - 60) / 3 * i + (w - 60) / 6;
      g.add(rect(cx - 18, 0, 36, 14, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 3 }));
      g.add(rect(cx - 18, h - 14, 36, 14, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 3 }));
    }
    return g;
  },

  'kitchen-counter': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke }));
    // 柜门分隔
    const cnt = Math.max(2, Math.round(w / 60));
    for (let i = 1; i < cnt; i++) {
      g.add(line([(w / cnt) * i, 0, (w / cnt) * i, h], c, { stroke: c.furnitureStroke, strokeWidth: 0.6 }));
    }
    return g;
  },

  'stove': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke }));
    // 4 个灶眼
    const r = Math.min(w, h) * 0.18;
    [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].forEach(([fx, fy]) => {
      g.add(new Konva.Circle({ x: w * fx, y: h * fy, radius: r, stroke: c.furnitureStroke, strokeWidth: 0.8 }));
      g.add(new Konva.Circle({ x: w * fx, y: h * fy, radius: r * 0.4, stroke: c.furnitureStroke, strokeWidth: 0.6 }));
    });
    return g;
  },

  'sink': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke }));
    g.add(rect(w * 0.1, h * 0.15, w * 0.8, h * 0.7, c, { fill: c.furnitureFill, stroke: c.furnitureStroke, cornerRadius: 4 }));
    g.add(new Konva.Circle({ x: w / 2, y: h * 0.15, radius: 2.5, fill: c.furnitureStroke }));
    return g;
  },

  'fridge': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 2 }));
    g.add(line([0, h / 3, w, h / 3], c, { stroke: c.furnitureStroke, strokeWidth: 0.8 }));
    return g;
  },

  'toilet': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h * 0.35, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 2 }));
    // 座圈（椭圆）
    g.add(new Konva.Ellipse({ x: w / 2, y: h * 0.65, radiusX: w * 0.42, radiusY: h * 0.32, fill: c.furnitureFill, stroke: c.furnitureStroke }));
    return g;
  },

  'basin': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 4 }));
    g.add(new Konva.Ellipse({ x: w / 2, y: h * 0.55, radiusX: w * 0.4, radiusY: h * 0.3, fill: c.furnitureFill, stroke: c.furnitureStroke }));
    g.add(new Konva.Circle({ x: w / 2, y: h * 0.18, radius: 3, fill: c.furnitureStroke }));
    return g;
  },

  'shower': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { dash: [4, 3] }));
    // 对角线
    g.add(line([0, 0, w, h], c, { strokeWidth: 0.6 }));
    g.add(line([w, 0, 0, h], c, { strokeWidth: 0.6 }));
    g.add(new Konva.Circle({ x: w / 2, y: h / 2, radius: Math.min(w, h) * 0.15, stroke: c.furnitureStroke, strokeWidth: 0.8 }));
    return g;
  },

  'bathtub': (obj, c) => {
    const g = baseGroup(obj, c);
    const { w, h } = obj;
    g.add(rect(0, 0, w, h, c, { cornerRadius: 12 }));
    g.add(rect(8, 8, w - 16, h - 16, c, { fill: 'transparent', stroke: c.furnitureDetail, cornerRadius: 8, strokeWidth: 0.8 }));
    g.add(new Konva.Circle({ x: w - 16, y: h / 2, radius: 3, fill: c.furnitureStroke }));
    return g;
  },
};

function buildBed(obj, c, isDouble) {
  const g = baseGroup(obj, c);
  const { w, h } = obj;
  // 床体
  g.add(rect(0, 0, w, h, c, { cornerRadius: 4 }));
  // 床头
  g.add(rect(0, 0, w, 18, c, { fill: c.furnitureDetail, stroke: c.furnitureStroke, cornerRadius: 3 }));
  if (isDouble) {
    // 两个枕头
    g.add(rect(8, 24, w / 2 - 12, 30, c, { stroke: c.furnitureDetail, cornerRadius: 4, strokeWidth: 0.8 }));
    g.add(rect(w / 2 + 4, 24, w / 2 - 12, 30, c, { stroke: c.furnitureDetail, cornerRadius: 4, strokeWidth: 0.8 }));
    // 中分线
    g.add(line([w / 2, 60, w / 2, h - 8], c, { strokeWidth: 0.6 }));
  } else {
    g.add(rect(10, 24, w - 20, 30, c, { stroke: c.furnitureDetail, cornerRadius: 4, strokeWidth: 0.8 }));
  }
  return g;
}

/**
 * 公共入口：根据 obj.subtype 创建图形组
 */
export function buildFurniture(obj) {
  const c = themeColors();
  const fn = builders[obj.subtype];
  if (!fn) {
    // 未实现的家具：用默认矩形
    const g = baseGroup(obj, c);
    g.add(rect(0, 0, obj.w, obj.h, c, { cornerRadius: 2 }));
    g.add(new Konva.Text({
      x: 4, y: 4, text: obj.label || obj.subtype,
      fontSize: 10, fill: c.textCanvasSec,
    }));
    return g;
  }
  return fn(obj, c);
}

/* ============ 灯光构造器（带夜间发光） ============ */

/**
 * 灯光符号：
 * - 白天：金色实心 + 简洁符号（无光晕）
 * - 黑夜：冷蓝白 + 径向光晕（用多层半透明圆模拟）
 */
export function buildLight(obj) {
  const c = themeColors();
  const meta = LIGHT_META[obj.subtype];
  const r = meta?.radius ?? 10;

  const g = new Konva.Group({
    id: obj.id,
    x: obj.x, y: obj.y,
    rotation: obj.rotation || 0,
    draggable: true,
    name: 'light-group',
  });

  // 夜间光晕（多层半透明圆）
  if (c.isNight) {
    [r * 4, r * 3, r * 2].forEach((radius, i) => {
      const opacity = [0.08, 0.16, 0.28][i];
      g.add(new Konva.Circle({
        radius,
        fill: c.lightColor,
        opacity,
        listening: false,
      }));
    });
  }

  // 主体符号
  switch (obj.subtype) {
    case 'downlight':
      g.add(new Konva.Circle({ radius: r, fill: c.lightColor, stroke: c.lightColor, strokeWidth: 1 }));
      g.add(new Konva.Circle({ radius: r * 0.5, fill: c.canvasBg }));
      break;
    case 'pendant':
      g.add(new Konva.Circle({ radius: r, stroke: c.lightColor, strokeWidth: 1.5 }));
      g.add(new Konva.Line({ points: [-r, 0, r, 0], stroke: c.lightColor, strokeWidth: 1.2 }));
      g.add(new Konva.Line({ points: [0, -r, 0, r], stroke: c.lightColor, strokeWidth: 1.2 }));
      break;
    case 'chandelier':
      g.add(new Konva.Rect({ x: -r * 1.4, y: -r * 0.3, width: r * 2.8, height: r * 0.6, fill: c.lightColor, cornerRadius: 2 }));
      g.add(new Konva.Circle({ x: -r * 0.9, radius: r * 0.25, fill: c.canvasBg, stroke: c.lightColor, strokeWidth: 0.8 }));
      g.add(new Konva.Circle({ x: 0, radius: r * 0.25, fill: c.canvasBg, stroke: c.lightColor, strokeWidth: 0.8 }));
      g.add(new Konva.Circle({ x: r * 0.9, radius: r * 0.25, fill: c.canvasBg, stroke: c.lightColor, strokeWidth: 0.8 }));
      break;
    case 'strip':
      g.add(new Konva.Rect({ x: -r * 1.6, y: -1.5, width: r * 3.2, height: 3, fill: c.lightColor, cornerRadius: 1.5 }));
      break;
    case 'sconce':
      // 星形
      g.add(new Konva.Star({ numPoints: 4, innerRadius: r * 0.3, outerRadius: r, fill: c.lightColor }));
      break;
    case 'bath-light':
      g.add(new Konva.Circle({ radius: r, stroke: c.lightColor, strokeWidth: 1.2 }));
      g.add(new Konva.Circle({ radius: r * 0.4, fill: c.lightColor }));
      break;
    case 'balcony-light':
      g.add(new Konva.Star({ numPoints: 6, innerRadius: r * 0.5, outerRadius: r, fill: c.lightColor }));
      break;
    default:
      g.add(new Konva.Circle({ radius: r, fill: c.lightColor }));
  }

  return g;
}
