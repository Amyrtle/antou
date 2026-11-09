/** 全站不允许 emoji：模型返回文本与用户输入都要过一遍 */
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu

export function stripEmoji(input: string): string {
  return input.replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').trim()
}
