/**
 * AI 对话面板 UI 逻辑
 *
 * - 底部抽屉：折叠/展开
 * - 消息流：用户气泡 + AI 气泡 + actions 预览卡
 * - 快捷指令 chip
 * - 流程：用户输入 → 显示 thinking → 调 API → 解析 JSON → 渲染消息 + 可点击「应用」
 */
import { state } from '../state.js';
import { chat, extractJSON } from './client.js';
import {
  buildSystemPrompt, summarizeCanvas, listObjectIds, QUICK_PROMPTS,
} from './prompts.js';
import { applyActions, describeActions } from './applier.js';
import { AI_CONFIG } from './config.js';

// 对话历史（不含 system，不含 canvas summary）
const history = [];

/* ============ DOM helpers ============ */
function $(sel, root = document) { return root.querySelector(sel); }
function el(tag, opts = {}) {
  const e = document.createElement(tag);
  if (opts.cls) e.className = opts.cls;
  if (opts.text != null) e.textContent = opts.text;
  if (opts.html != null) e.innerHTML = opts.html;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) e.setAttribute(k, v);
  if (opts.on) for (const [k, v] of Object.entries(opts.on)) e.addEventListener(k, v);
  return e;
}

/* ============ 面板初始化 ============ */
export function initAIPanel() {
  const panel = $('#aiPanel');
  if (!panel) return;

  const toggle    = $('#aiToggle');
  const closeBtn  = $('#aiClose');
  const messages  = $('#aiMessages');
  const input     = $('#aiInput');
  const sendBtn   = $('#aiSend');
  const clearBtn  = $('#aiClear');
  const chipsRow  = $('#aiChips');
  const fab       = $('#aiFab');

  // 渲染快捷 chips
  QUICK_PROMPTS.forEach(qp => {
    const chip = el('button', {
      cls: 'ai-chip',
      text: qp.label,
      on: { click: () => {
        input.value = qp.prompt;
        input.focus();
        // 自动调高 textarea
        autoresize(input);
      }},
    });
    chipsRow.appendChild(chip);
  });

  // 折叠 / 展开
  function setOpen(open) {
    document.body.dataset.aiOpen = String(open);
    if (open) {
      input.focus();
      // 滚到底
      messages.scrollTop = messages.scrollHeight;
    }
  }
  toggle.addEventListener('click', () => setOpen(document.body.dataset.aiOpen !== 'true'));
  closeBtn.addEventListener('click', () => setOpen(false));
  fab.addEventListener('click', () => setOpen(true));

  // 默认收起
  setOpen(false);

  // 清空对话
  clearBtn.addEventListener('click', () => {
    if (history.length === 0) return;
    if (!confirm('确定清空当前对话？')) return;
    history.length = 0;
    messages.innerHTML = '';
    welcome();
  });

  // textarea 自动调高
  input.addEventListener('input', () => autoresize(input));

  // 发送
  async function doSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    autoresize(input);
    await sendMessage(text);
  }
  sendBtn.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => {
    // Cmd/Ctrl+Enter 或 Enter（无 shift）发送
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  // 欢迎消息
  welcome();

  /* ===== sendMessage ===== */
  async function sendMessage(userText) {
    appendUser(userText);
    const thinkingNode = appendThinking();

    try {
      // 构造 messages
      const sys = buildSystemPrompt();
      const canvasCtx = summarizeCanvas(state) + listObjectIds(state, 80);
      // 保留最近 N 轮
      const trimmed = history.slice(-AI_CONFIG.maxHistoryTurns * 2);
      const messages = [
        { role: 'system', content: sys },
        // 把当前画布注入到本轮 user 前，体现"当前上下文"
        ...trimmed,
        { role: 'user', content: `${canvasCtx}\n\n## 用户问题\n${userText}` },
      ];

      const result = await chat(messages, {
        temperature: 0.5,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });

      thinkingNode.remove();

      const parsed = extractJSON(result.content) || tryFallbackParse(result.content);
      if (!parsed) {
        appendAI({
          reply: '抱歉，我没能给出结构化的回复。原始内容：\n\n' + result.content.slice(0, 800),
          actions: [],
        }, { errored: true });
        history.push({ role: 'user', content: userText });
        history.push({ role: 'assistant', content: result.content });
        return;
      }

      appendAI(parsed, { usage: result.usage });

      // 维护对话历史（只存核心，不重传 canvas）
      history.push({ role: 'user', content: userText });
      history.push({ role: 'assistant', content: JSON.stringify({
        reply: parsed.reply || '',
        actions_count: Array.isArray(parsed.actions) ? parsed.actions.length : 0,
      })});
    } catch (e) {
      thinkingNode.remove();
      appendError(e.message || String(e));
    } finally {
      messages.scrollTop = messages.scrollHeight;
    }
  }

  /* ===== UI 渲染 ===== */
  function welcome() {
    const w = el('div', { cls: 'ai-msg ai-msg-system', html: `
      <div class="ai-bubble ai-bubble-system">
        👋 嗨，我是户型 AI 助手（智谱 GLM-4-Flash）。<br/>
        你可以让我：<b>生成布局</b> · <b>添加灯光</b> · <b>优化动线</b> · <b>解释当前</b><br/>
        点下方快捷按钮试试，或直接描述你的需求 ✍️
      </div>
    ` });
    messages.appendChild(w);
  }

  function appendUser(text) {
    const node = el('div', { cls: 'ai-msg ai-msg-user' });
    node.appendChild(el('div', { cls: 'ai-bubble ai-bubble-user', text }));
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
  }

  function appendThinking() {
    const node = el('div', { cls: 'ai-msg ai-msg-ai' });
    node.appendChild(el('div', { cls: 'ai-bubble ai-bubble-ai ai-thinking', html: `
      <span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>
      <span class="ai-thinking-label">AI 思考中…</span>
    ` }));
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function appendAI(parsed, opts = {}) {
    const wrap = el('div', { cls: 'ai-msg ai-msg-ai' });
    const bubble = el('div', { cls: 'ai-bubble ai-bubble-ai' + (opts.errored ? ' ai-bubble-warn' : '') });
    bubble.textContent = parsed.reply || '(无回复)';
    wrap.appendChild(bubble);

    // actions 预览卡
    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      const card = el('div', { cls: 'ai-action-card' });
      card.appendChild(el('div', {
        cls: 'ai-action-title',
        html: `🎯 建议操作：<b>${describeActions(parsed.actions)}</b>`,
      }));

      const btnRow = el('div', { cls: 'ai-action-btns' });
      const applyBtn = el('button', {
        cls: 'btn btn-primary btn-small',
        text: '✓ 应用到画布',
      });
      const previewBtn = el('button', {
        cls: 'btn btn-small',
        text: '查看 JSON',
      });
      const ignoreBtn = el('button', {
        cls: 'btn btn-small',
        text: '忽略',
      });

      applyBtn.addEventListener('click', () => {
        const r = applyActions(parsed.actions);
        if (r.applied > 0) {
          applyBtn.disabled = true;
          applyBtn.textContent = `✓ 已应用 ${r.applied} 项 (Cmd+Z 可撤销)`;
          ignoreBtn.disabled = true;
        } else {
          card.appendChild(el('div', {
            cls: 'ai-action-error',
            text: '应用失败：\n' + r.errors.slice(0, 5).join('\n'),
          }));
        }
      });
      previewBtn.addEventListener('click', () => {
        const pre = card.querySelector('.ai-action-json');
        if (pre) { pre.remove(); previewBtn.textContent = '查看 JSON'; return; }
        const p = el('pre', {
          cls: 'ai-action-json',
          text: JSON.stringify(parsed.actions, null, 2),
        });
        card.appendChild(p);
        previewBtn.textContent = '收起 JSON';
      });
      ignoreBtn.addEventListener('click', () => {
        applyBtn.disabled = true;
        ignoreBtn.disabled = true;
        previewBtn.disabled = true;
        card.style.opacity = '0.5';
      });

      btnRow.append(applyBtn, previewBtn, ignoreBtn);
      card.appendChild(btnRow);
      wrap.appendChild(card);
    }

    if (opts.usage) {
      wrap.appendChild(el('div', {
        cls: 'ai-meta',
        text: `tokens: ${opts.usage.prompt_tokens || '?'} → ${opts.usage.completion_tokens || '?'}`,
      }));
    }

    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  function appendError(msg) {
    const node = el('div', { cls: 'ai-msg ai-msg-ai' });
    node.appendChild(el('div', { cls: 'ai-bubble ai-bubble-ai ai-bubble-error', text: '⚠ ' + msg }));
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
  }
}

function autoresize(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
}

// 兜底解析：有时模型不严格 JSON，把整段当 reply
function tryFallbackParse(text) {
  if (!text) return null;
  return { reply: String(text).slice(0, 1500), actions: [] };
}
