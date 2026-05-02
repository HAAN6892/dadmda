import Anthropic from "@anthropic-ai/sdk"

let anthropicClient: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (anthropicClient) {
    return anthropicClient
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요."
    )
  }

  anthropicClient = new Anthropic({ apiKey })
  return anthropicClient
}
