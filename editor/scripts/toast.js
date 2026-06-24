/**
 * 轻量级 toast 提示：非阻塞地反馈操作结果（替代 alert）
 * 用法：toast('已导出'); toast('加载失败', 'error'); toast('丢弃了 2 个无效对象', 'warn')
 */

let root = null;

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'toast-root';
    document.body.appendChild(root);
  }
  return root;
}

/**
 * @param {string} message 文本
 * @param {'info'|'success'|'warn'|'error'} type 类型（决定配色）
 * @param {number} duration 毫秒，默认按类型自动延长警告/错误
 */
export function toast(message, type = 'info', duration) {
  if (!message) return;
  const container = ensureRoot();

  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  const icon = { info: 'ℹ', success: '✓', warn: '⚠', error: '✕' }[type] || 'ℹ';
  node.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text"></span>`;
  node.querySelector('.toast-text').textContent = message;
  container.appendChild(node);

  // 进场动画
  requestAnimationFrame(() => node.classList.add('toast-show'));

  const ttl = duration ?? (type === 'error' ? 6000 : type === 'warn' ? 4500 : 2600);
  const timer = setTimeout(dismiss, ttl);
  node.addEventListener('click', dismiss);

  function dismiss() {
    clearTimeout(timer);
    node.classList.remove('toast-show');
    node.addEventListener('transitionend', () => node.remove(), { once: true });
    // 兜底：动画未触发也要移除
    setTimeout(() => node.remove(), 300);
  }

  return dismiss;
}
