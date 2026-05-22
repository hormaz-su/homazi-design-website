/**
 * 智谱 GLM API 客户端封装
 *
 * 提供两种调用方式：
 *  - chat(messages, opts) → 一次性返回完整内容（推荐，稳定）
 *  - chatStream(messages, opts, onChunk) → 流式输出（体验好但解析 JSON 时不必）
 */
import { AI_CONFIG } from './config.js';

let lastCallAt = 0;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 节流：保证两次调用间隔 ≥ minIntervalMs
 */
async function throttle() {
  const now = Date.now();
  const wait = AI_CONFIG.minIntervalMs - (now - lastCallAt);
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

/**
 * 发起一次完整调用（非流式）
 * @param {Array<{role:string,content:string}>} messages
 * @param {Object} opts - { temperature, max_tokens, response_format }
 * @returns {Promise<string>} AI 回复文本
 */
export async function chat(messages, opts = {}) {
  await throttle();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_CONFIG.timeoutMs);

  try {
    const resp = await fetch(AI_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model || AI_CONFIG.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens ?? 2048,
        // 智谱也支持 response_format: { type: "json_object" }
        ...(opts.response_format ? { response_format: opts.response_format } : {}),
      }),
      signal: ctrl.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`AI 调用失败 (HTTP ${resp.status}): ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI 返回为空');
    }
    return {
      content,
      usage: data?.usage || null,
      raw: data,
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('AI 请求超时，请稍后重试');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从 AI 文本中抽取 JSON 对象（容错：去掉 ```json 围栏 / 前后说明文字）
 */
export function extractJSON(text) {
  if (!text) return null;
  let s = String(text).trim();

  // 去掉 markdown 代码围栏
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // 找第一个 { 到最后一个 }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;

  const candidate = s.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    // 二次尝试：清理常见错误
    try {
      const cleaned = candidate
        .replace(/,\s*([}\]])/g, '$1')   // 尾随逗号
        .replace(/\bNaN\b/g, '0');        // NaN
      return JSON.parse(cleaned);
    } catch (e2) {
      return null;
    }
  }
}
