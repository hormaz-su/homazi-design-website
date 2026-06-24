# 霍玛兹 · Homazi Design

室内设计作品展示 + 在线户型设计工具。纯静态站点，无构建步骤，托管于 GitHub Pages。

🔗 在线访问：<https://hormaz-su.github.io/homazi-design-website/>

---

## 两个部分

### 1. 作品展示页（`index.html`）

一层室内空间设计的展示页面：日夜双境的平面图、空间叙事、分层照明系统、设计理念。响应式布局，支持白天 / 黑夜主题。

### 2. Homazi Floor Editor（`editor/`）

浏览器内的户型平面设计器，无需安装、即开即用：

- **绘图工具** — 墙体、门（含开启弧）、窗、文字标注、尺寸标注、比例尺、指北针
- **素材库** — 拖放放置家具（沙发 / 床 / 餐桌 / 厨卫等 19 种）与灯光（筒灯 / 吊灯 / 灯带等 7 种），夜间模式下灯光带发光效果
- **画布操作** — 滚轮缩放、空格 / 中键平移、框选、属性面板精确调整（坐标 / 尺寸 / 旋转）
- **撤销 / 重做** — 50 步历史，自动保存到 localStorage
- **导入 / 导出** — JSON 工程文件、PNG 图片
- **白天 / 黑夜主题** — 一键切换，画布配色随之改变
- **AI 设计助手** ✨ — 接入智谱 GLM-4-Flash，用自然语言生成布局、补充灯光、优化动线；AI 的修改建议需你点击「应用到画布」后才生效，且可一键撤销

进入编辑器：站点首页点击入口，或直接访问 `/editor/`。

## 本地预览

无需依赖，任意静态服务器即可：

```bash
cd website
python3 -m http.server 8000
# 展示页：http://localhost:8000/
# 编辑器：http://localhost:8000/editor/
```

## 部署

推送到 `main` 分支，GitHub Pages 自动从仓库根目录发布。无 CI / 构建 / 测试流程——改动请在浏览器中验证。

## 技术栈

- 原生 HTML / CSS / ES Modules，**无框架、无打包**
- [Konva 9](https://konvajs.org/)（通过 CDN `<script>` 引入）负责编辑器画布渲染
- 智谱 GLM-4-Flash API 提供 AI 能力

> ⚠ 编辑器的 AI 功能将 API Key 硬编码在前端（`editor/scripts/ai/config.js`），仅用于 demo。该 Key 在智谱开放平台限定了免费模型与每日额度。

## 目录结构

```
website/
├── index.html              # 作品展示页
├── assets/                 # 展示页样式 / 脚本 / 图片
├── editor/
│   ├── index.html          # 编辑器界面
│   ├── styles/editor.css
│   └── scripts/            # 模块化 JS（state / stage / renderer / tools / ai …）
└── CLAUDE.md               # 架构说明（面向开发者 / AI 协作）
```

编辑器的架构细节见 [`CLAUDE.md`](./CLAUDE.md)。
