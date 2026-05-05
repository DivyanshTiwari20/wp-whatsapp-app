import type { NextRequest } from "next/server"

function getAllowedOrigins() {
  const configured = (process.env.WEBHOOK_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  if (configured.length > 0) {
    return configured
  }

  return ["*"]
}

export function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  const allowedOrigins = getAllowedOrigins()

  if (allowedOrigins.includes("*")) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret",
    } as const
  }

  const isAllowed = origin ? allowedOrigins.includes(origin) : false
  const allowOrigin = isAllowed ? origin : allowedOrigins[0]

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret",
    Vary: "Origin",
  } as const
}

