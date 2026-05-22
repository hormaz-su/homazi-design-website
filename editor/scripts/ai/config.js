/**
 * AI 配置
 *
 * ⚠ 安全提示：API Key 硬编码在前端 JS 中，任何访问该站点的用户都能从浏览器
 * 开发者工具 / 查看源码 看到这个 Key。仅用于个人 demo / 内部 demo。
 *
 * 防护建议：
 *  1. 在智谱开放平台 https://open.bigmodel.cn 给该 Key 限定只能调免费模型 (glm-4-flash)
 *  2. 设置每日额度上限
 *  3. 一旦发现异常调用，进入开放平台 → API keys 删除并替换
 */
export const AI_CONFIG = {
  endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  apiKey: 'dd8eab801707449b82af72ccf8a3a387.S1yxDi6Fix6nqGWV',
  model: 'glm-4-flash',
  // 简单的客户端节流：最少 1.5 秒间隔（缓解被刷 + 避免触发 QPS）
  minIntervalMs: 1500,
  // 单次请求超时（毫秒）
  timeoutMs: 60000,
  // 最大上下文消息数（保留最近 N 轮对话）
  maxHistoryTurns: 6,
};
