/**
 * 户型模板：一层平面（参考 floor-day.jpg）
 *
 * 坐标系：cm，原点为画布中心，y 向下为正（屏幕坐标）
 * 整体房型：约 1500cm × 1200cm（含三阳台外凸）
 *
 * 房间分区（北上、南下、东右、西左）：
 *   北侧上方：横向长阳台
 *   西北：厨房   东北：电视房（右上角斜切阳台）
 *   西中：楼梯间 东中：餐厅
 *   西南：卧室   东南：客厅
 *   南侧下方：小阳台
 */
import { genId } from './state.js';

export function buildFloorDayTemplate() {
  const objs = [];
  const wall = (x1, y1, x2, y2, thickness = 22) =>
    objs.push({ id: genId('wall'), type: 'wall', points: [x1, y1, x2, y2], thickness });
  const innerWall = (x1, y1, x2, y2) => wall(x1, y1, x2, y2, 14);
  const text = (x, y, t, fontSize = 16, bold = false) =>
    objs.push({ id: genId('text'), type: 'text', x, y, text: t, fontSize, bold, rotation: 0 });
  const furn = (subtype, x, y, w, h, rotation = 0, label) =>
    objs.push({ id: genId('furn'), type: 'furniture', subtype, x, y, w, h, rotation, label });
  const light = (subtype, x, y, rotation = 0) =>
    objs.push({ id: genId('light'), type: 'light', subtype, x, y, rotation });
  const door = (x, y, w = 80, rotation = 0) =>
    objs.push({ id: genId('door'), type: 'door', x, y, w, rotation });
  const win = (x, y, w = 150, rotation = 0) =>
    objs.push({ id: genId('window'), type: 'window', x, y, w, rotation });

  /* ============ 主轮廓（外墙） ============
     主体矩形：x ∈ [-700, 700]，y ∈ [-500, 500]
     北阳台外凸：北侧上方 [-500..-100] 区间向上凸 100cm（y=-600）
     东北斜切阳台：右上角 [400, -500] → [700, -300] 形成 45° 切角，外凸至 [800, -300]
     南阳台外凸：南侧下方 [50..350] 区间向下凸 100cm（y=600）
  */

  // 西外墙
  wall(-700, -500, -700, 500);
  // 南外墙
  wall(-700, 500, 50, 500);
  wall(50, 500, 50, 600);     // 南阳台西墙
  wall(50, 600, 350, 600);    // 南阳台南墙（外）
  wall(350, 600, 350, 500);   // 南阳台东墙
  wall(350, 500, 700, 500);
  // 东外墙（南段）
  wall(700, 500, 700, -300);
  // 东北斜切角（45°切到右上）
  wall(700, -300, 500, -500);
  // 北外墙（东段：从斜切点到北阳台凸起）
  wall(500, -500, -100, -500);
  // 北阳台凸起
  wall(-100, -500, -100, -600);
  wall(-100, -600, -500, -600);
  wall(-500, -600, -500, -500);
  // 北外墙（西段）
  wall(-500, -500, -700, -500);

  /* ============ 内墙分区 ============
     横向分隔线：y = -150（厨房/电视房 与 餐厅/楼梯间 之间）
                y =  150（餐厅/楼梯间 与 客厅/卧室 之间）
     纵向分隔线：x = -250（西侧厨房/楼梯间/卧室 与 东侧公共空间）
                x = -150（卧室小卫生间）
  */

  // 横向内墙
  innerWall(-700, -150, -250, -150);   // 厨房 ↔ 楼梯间 间墙
  innerWall(-150, -150,  700, -150);   // 电视房 ↔ 餐厅 间墙（电视房南墙）
  innerWall(-700,  150, -250,  150);   // 楼梯间 ↔ 卧室 间墙
  innerWall(-150,  150,  700,  150);   // 餐厅 ↔ 客厅 间墙

  // 纵向内墙
  innerWall(-250, -500, -250, -150);   // 厨房东墙
  innerWall(-250,  150, -250,  500);   // 卧室东墙（卧室和客厅间墙）

  // 卧室小卫生间（卧室东侧，靠东内墙的小隔间）
  innerWall(-250,  350, -150,  350);   // 卫生间南墙
  innerWall(-150,  150, -150,  500);   // 卫生间东墙（封闭）

  /* ============ 门 ============ */
  // 厨房门（朝楼梯间，南墙开口）
  door(-450, -150, 80, 0);
  // 楼梯间通往餐厅（楼梯间东墙）
  door(-250, 0, 80, 90);
  // 电视房通餐厅（电视房南墙）
  door(100, -150, 90, 0);
  // 餐厅通客厅（餐厅南墙）
  door(200, 150, 90, 0);
  // 卧室门（卧室北墙）
  door(-500, 150, 80, 0);
  // 卧室小卫生间门
  door(-200, 350, 60, 0);
  // 客厅通南阳台
  door(180, 500, 80, 0);
  // 厨房通北阳台
  door(-400, -500, 80, 0);

  /* ============ 窗 ============ */
  // 客厅东窗
  win(700, 320, 200, 90);
  // 卧室西窗
  win(-700, 320, 180, 90);
  // 餐厅东窗
  win(700, 0, 180, 90);
  // 电视房东窗（斜切前）
  win(700, -380, 100, 90);
  // 北阳台外侧窗
  win(-400, -600, 200, 0);

  /* ============ 房间标注 ============ */
  text(-540, -340, 'Kitchen', 17, true);
  text(-510, -312, '厨房', 11);

  text(220, -360, 'TV Room', 17, true);
  text(250, -332, '电视房', 11);

  text(220, -10, 'Dining', 17, true);
  text(250, 18, '餐厅', 11);

  text(220, 320, 'Living Room', 17, true);
  text(250, 350, '客厅', 11);

  text(-540, 290, 'Bed Room', 17, true);
  text(-510, 318, '卧室', 11);

  text(-490, 0, 'Stairs', 13, true);
  text(-490, 22, '楼梯间', 10);

  text(-340, -560, 'Balcony', 11);
  text(620, -440, 'Balcony', 10, false);
  text(160, 560, 'Balcony', 10);

  /* ============ 楼梯（用线条简化表达） ============ */
  // 楼梯间 x ∈ [-700, -250], y ∈ [-150, 150]
  // 上行 UP（北段），下行 DN（南段），中间休息平台
  for (let i = 0; i < 7; i++) {
    const ty = -130 + i * 18;
    objs.push({ id: genId('text'), type: 'text', x: -650, y: ty, text: '────', fontSize: 8, rotation: 0 });
  }
  text(-560, -120, 'UP', 10, true);
  text(-560,  100, 'DN', 10, true);

  /* ============ 家具 ============ */

  // —— 厨房（左上 x∈[-700,-250], y∈[-500,-150]）——
  // L 形操作台：北墙 + 西墙
  furn('kitchen-counter', -480, -480, 380, 60, 0, '北墙操作台');     // 中心 x=-480, y=-480
  furn('kitchen-counter', -670, -325, 50, 280, 0, '西墙操作台');
  // 灶台
  furn('stove', -640, -460, 60, 60, 0, '灶台');
  // 水槽
  furn('sink', -340, -460, 80, 50, 0, '水槽');
  // 冰箱
  furn('fridge', -290, -465, 70, 70, 0, '冰箱');
  // 中岛（小早餐台）
  furn('kitchen-counter', -400, -260, 200, 60, 0, '中岛');
  furn('armchair', -510, -200, 50, 50, 0, '吧台椅');
  furn('armchair', -400, -200, 50, 50, 0, '吧台椅');
  furn('armchair', -290, -200, 50, 50, 0, '吧台椅');

  // —— 电视房（右上 x∈[-150,700], y∈[-500,-150]）——
  furn('tv-stand', 270, -480, 320, 40, 0, '电视柜');
  furn('sofa-l', 280, -310, 240, 180, 0, 'L 形沙发');
  furn('coffee-table', 280, -260, 100, 60, 0, '茶几');
  furn('armchair', 50, -250, 70, 70, 0, '单人椅');
  furn('armchair', 600, -200, 70, 70, 0, '单人椅');

  // —— 餐厅（中右 x∈[-150,700], y∈[-150,150]）——
  furn('dining-table', 270, 0, 280, 130, 0, '餐桌');

  // —— 客厅（右下 x∈[-150,700], y∈[150,500]）——
  furn('sofa-3', 200, 460, 240, 90, 0, '三人沙发');
  furn('coffee-table', 280, 360, 130, 70, 0, '茶几');
  furn('armchair', 70, 360, 80, 80, 0, '单人椅');
  furn('tv-stand', 620, 350, 50, 220, 90, '电视柜');

  // —— 卧室（左下 x∈[-700,-250], y∈[150,500]）——
  furn('bed-double', -480, 280, 180, 200, 0, '双人床');
  furn('nightstand', -600, 200, 50, 40, 0, '床头柜');
  furn('nightstand', -360, 200, 50, 40, 0, '床头柜');
  furn('wardrobe', -670, 460, 200, 60, 90, '衣柜');
  furn('desk', -360, 460, 100, 50, 0, '书桌');

  // —— 卧室小卫生间（x∈[-250,-150], y∈[350,500]）——
  furn('toilet', -200, 400, 40, 60, 0, '马桶');
  furn('basin', -200, 470, 60, 35, 0, '洗手盆');

  /* ============ 灯光 ============ */
  // 厨房：3 颗筒灯 + 灯带
  light('downlight', -600, -380);
  light('downlight', -480, -380);
  light('downlight', -360, -380);
  light('strip', -500, -460);

  // 电视房：4 颗筒灯 + 1 个吊灯
  light('downlight', 50, -350);
  light('downlight', 270, -350);
  light('downlight', 500, -350);
  light('downlight', 50, -200);
  light('pendant', 280, -260);

  // 餐厅：线性吊灯
  light('chandelier', 270, 0);
  light('downlight', 50, 0);
  light('downlight', 600, 0);

  // 客厅：吊灯 + 4 筒灯
  light('pendant', 280, 360);
  light('downlight', 50, 250);
  light('downlight', 50, 450);
  light('downlight', 500, 250);
  light('downlight', 600, 450);

  // 卧室：吊灯 + 2 壁灯（床头）+ 2 筒灯
  light('pendant', -480, 320);
  light('sconce', -600, 200);
  light('sconce', -360, 200);
  light('downlight', -650, 460);
  light('downlight', -300, 460);

  // 卫浴灯
  light('bath-light', -200, 430);

  // 阳台灯
  light('balcony-light', -300, -560);
  light('balcony-light', 600, -440);
  light('balcony-light', 200, 560);

  // 楼梯灯
  light('downlight', -500, -50);
  light('downlight', -500, 50);

  /* ============ 比例尺 + 指北针 + 标题 ============ */
  objs.push({ id: genId('scale'), type: 'scale', x: -700, y: 660, totalCm: 500 });
  objs.push({ id: genId('compass'), type: 'compass', x: 750, y: 660, rotation: 0 });
  text(-50, 680, 'First Floor Plan · 一层平面图', 14, true);

  return objs;
}
