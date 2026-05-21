/* ============================================================
   Homazi · First Floor Plan — Interactions
   - 日夜主题切换（含 LocalStorage 记忆）
   - 平面图 day / night 模式切换
   - 房间芯片点击 → 弹窗详情
   - 滚动时导航高亮 + 入场动画
   ============================================================ */

(function () {
  "use strict";

  // ---------- 房间数据（与首页 cards 同步） ----------
  const ROOM_DATA = {
    kitchen: {
      icon: "🍳",
      title: "厨房 Kitchen",
      loc: "左上 · A–B 轴 · ①–②",
      desc: "L 型橱柜配中央岛台，岛台上方暖色吊灯成为视觉焦点。橱柜下方嵌入线性灯带，提供精准操作照明。与餐厅无缝相连，备餐与社交可同时发生。",
      list: [
        "Pendant Light · 装饰吊灯",
        "Under-Cabinet Strip · 操作灯带",
        "Recessed Downlight 辅助主照明",
        "与餐厅无缝相连",
      ],
    },
    tv: {
      icon: "📺",
      title: "电视房 TV Room",
      loc: "右上 · B–C 轴 · ①–②",
      desc: "L 型沙发组合 + 媒体墙，多颗嵌入式筒灯均匀分布。开放格局让屏幕前的休闲与餐桌的社交自然延伸。",
      list: [
        "Recessed Downlight × N",
        "与餐厅开放连通",
        "紧邻东北角小阳台",
        "L 型沙发 + 媒体墙",
      ],
    },
    dining: {
      icon: "🍽",
      title: "餐厅 Dining",
      loc: "右侧中部 · 公区核心",
      desc: "可坐 8–10 人的长方形餐桌，正上方的线性吊灯是整层最具仪式感的光源装置。一桌之力，串联起厨房、客厅与电视房三个方向。",
      list: [
        "Linear Chandelier · 线性吊灯（视觉焦点）",
        "与厨房 / 客厅 / 电视房三向贯通",
        "兼具就餐与社交功能",
        "8–10 人席位",
      ],
    },
    living: {
      icon: "🛋",
      title: "客厅 Living Room",
      loc: "右下 · 全层最大空间",
      desc: "多组沙发自由组合，毗邻南向阳台，自然光充沛。均匀筒灯铺底 + 阳台灯收边，营造柔和过渡。",
      list: [
        "Recessed Downlight 阵列",
        "Balcony Light 衔接室外",
        "南向阳台无缝过渡",
        "L 型沙发 + 单椅 + 茶几",
      ],
    },
    bedroom: {
      icon: "🛏",
      title: "卧室 Bed Room",
      loc: "左下 · ④–⑤ 轴",
      desc: "双人床配独立卫浴与衣帽空间，床头两侧对称壁灯，营造私密的夜读氛围。直通南向小阳台，是属于自己的安静角落。",
      list: [
        "Wall Sconce × 2 · 床头壁灯",
        "Bathroom Fixture · 卫浴灯",
        "独立卫生间 + 衣柜",
        "直通南向小阳台",
      ],
    },
    stairs: {
      icon: "🪜",
      title: "楼梯间 Staircase",
      loc: "平面正中 · 动线枢纽",
      desc: "双跑楼梯，DN 通向地下层，UP 连接二层。居中布局让所有空间环绕展开，是动线最短化的关键。",
      list: [
        "DN · 通向地下层",
        "UP · 连接二层",
        "动线最短化设计",
        "视觉与功能的中心",
      ],
    },
    balcony: {
      icon: "🌿",
      title: "阳台 Balcony × 3",
      loc: "北侧 / 东北角 / 南侧",
      desc: "三处阳台环抱主体空间，均配独立阳台灯。东北角阳台以热带阔叶植物点缀，模糊室内外边界，让风、光与绿色都能走进屋子里。",
      list: [
        "北侧 · 厨房延伸阳台",
        "东北 · 角落绿植阳台（热带阔叶）",
        "南侧 · 卧室与客厅之间",
        "均配独立 Balcony Light",
      ],
    },
  };

  // ---------- 1. 主题切换 ----------
  const THEME_KEY = "homazi-theme";
  const themeToggle = document.getElementById("themeToggle");

  // 先声明 plan 相关元素，供 setPlanMode 引用（避免 TDZ）
  const planTabs = document.querySelectorAll(".plan__tab");
  const planImages = {
    day: document.querySelector(".plan__image--day"),
    night: document.querySelector(".plan__image--night"),
  };

  function setPlanMode(mode) {
    planTabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.mode === mode);
    });
    Object.entries(planImages).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle("is-active", key === mode);
    });
  }

  function setTheme(mode) {
    document.body.setAttribute("data-theme", mode);
    localStorage.setItem(THEME_KEY, mode);
    // 同步切换平面图模式
    setPlanMode(mode);
    // 更新按钮文字
    const label = themeToggle.querySelector(".theme-toggle__label");
    if (label) label.textContent = mode === "day" ? "夜" : "日";
  }

  // 启动时读取偏好
  const savedTheme = localStorage.getItem(THEME_KEY) || "day";
  setTheme(savedTheme);

  themeToggle.addEventListener("click", () => {
    const cur = document.body.getAttribute("data-theme");
    setTheme(cur === "day" ? "night" : "day");
  });

  // ---------- 2. 平面图 day / night 标签切换 ----------
  planTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode;
      setPlanMode(mode);
      // 平面图切换不强制改变全站主题，但可以联动：
      setTheme(mode);
    });
  });

  // ---------- 3. 房间芯片 → 弹窗 ----------
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modalContent");

  function openRoom(key) {
    const data = ROOM_DATA[key];
    if (!data) return;
    modalContent.innerHTML = `
      <small>${data.loc}</small>
      <h3>${data.icon} ${data.title}</h3>
      <p>${data.desc}</p>
      <ul>
        ${data.list.map((i) => `<li>✦ ${i}</li>`).join("")}
      </ul>
    `;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeRoom() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => openRoom(chip.dataset.room));
  });
  modal.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", closeRoom);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeRoom();
  });

  // ---------- 4. 入场动画（IntersectionObserver） ----------
  const reveal = (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  };

  const io = new IntersectionObserver(reveal, {
    threshold: 0.12,
  });

  document
    .querySelectorAll(".room-card, .legend__item, .concept__card, .stat")
    .forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(28px)";
      el.style.transition = `opacity 0.7s ease ${i * 0.05}s, transform 0.7s ease ${i * 0.05}s`;
      io.observe(el);
    });

  // ---------- 5. 导航高亮 ----------
  const navLinks = document.querySelectorAll(".nav__links a");
  const sectionIds = ["hero", "plan", "rooms", "lighting", "concept"];
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  function onScroll() {
    const scrollY = window.scrollY + 120;
    let active = sections[0]?.id;
    sections.forEach((sec) => {
      if (sec.offsetTop <= scrollY) active = sec.id;
    });
    navLinks.forEach((link) => {
      link.classList.toggle(
        "is-active",
        link.getAttribute("href") === `#${active}`
      );
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- 6. 控制台彩蛋 ----------
  console.log(
    "%c HOMAZI · 霍玛兹建筑设计 ",
    "background:#b48a4a;color:#fff;padding:6px 14px;border-radius:4px;font-family:serif;font-size:14px"
  );
  console.log(
    "%c First Floor Plan · 现代简约住宅一层平面",
    "color:#8a877f;font-size:12px"
  );
})();
