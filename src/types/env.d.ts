declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string
    ANTHROPIC_API_KEY: string
    UPSTASH_REDIS_REST_URL: string
    UPSTASH_REDIS_REST_TOKEN: string
  }
}

export {}
