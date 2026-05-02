// 임시: connection test 전용. 페르소나 기능 작업 시작 시 삭제 예정.
import { NextResponse } from "next/server"
import { getAnthropicClient } from "@/lib/anthropic/client"

export async function GET() {
  try {
    const client = getAnthropicClient()

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: "한국어로 '연결 성공' 4글자만 답하세요.",
        },
      ],
    })

    const textContent = response.content.find((block) => block.type === "text")

    return NextResponse.json({
      success: true,
      model: response.model,
      response: textContent?.type === "text" ? textContent.text : null,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 에러",
      },
      { status: 500 }
    )
  }
}
