import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

let ratelimitInstance: Ratelimit | null = null

export function getRatelimit(): Ratelimit {
  if (ratelimitInstance) {
    return ratelimitInstance
  }

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL 또는 UPSTASH_REDIS_REST_TOKEN 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요."
    )
  }

  const redis = Redis.fromEnv()

  ratelimitInstance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "@dadmda/ratelimit",
  })

  return ratelimitInstance
}
