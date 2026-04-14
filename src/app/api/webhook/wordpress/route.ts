import { NextRequest, NextResponse } from "next/server"
import { getWelcomeMessage } from "@/lib/templates"
import { markWelcomeStatus, upsertSubmission } from "@/lib/submissions"
import { sendWelcomeWhatsApp } from "@/lib/whatsapp"
import { normalizeWordPressPayload } from "@/lib/wordpress"

function getAllowedOrigins() {
  const configured = (process.env.WEBHOOK_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  if (configured.length > 0) {
    return configured
  }

  return ["https://jashneadab.org", "https://www.jashneadab.org"]
}

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  const allowedOrigins = getAllowedOrigins()
  const isAllowed = origin ? allowedOrigins.includes(origin) : false

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret",
    Vary: "Origin",
  }
}

function jsonWithCors(request: NextRequest, body: unknown, init?: { status?: number }) {
  const response = NextResponse.json(body, init)
  const headers = getCorsHeaders(request)

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 })
  const headers = getCorsHeaders(request)

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.WORDPRESS_WEBHOOK_SECRET
  const providedSecret = request.headers.get("x-webhook-secret")

  if (expectedSecret && providedSecret !== expectedSecret) {
    return jsonWithCors(request, { error: "Unauthorized webhook request" }, { status: 401 })
  }

  try {
    const payload = await request.json()
    const normalized = normalizeWordPressPayload(payload)

    if (!normalized.phone) {
      return jsonWithCors(request, { error: "Phone number missing in payload" }, { status: 400 })
    }

    const { submission } = await upsertSubmission(normalized, payload)

    if (submission.welcomeStatus !== "sent") {
      const message = getWelcomeMessage({
        name: submission.name,
        eventAt: submission.eventAt ? new Date(submission.eventAt) : null,
      })

      const result = await sendWelcomeWhatsApp(submission.phone, message)
      await markWelcomeStatus(submission.id, result.success, result.success ? undefined : result.message, {
        messageId: result.messageId,
        deliveryStatus: result.deliveryStatus,
      })

      return jsonWithCors(request, {
        success: result.success,
        submissionId: submission.id,
        externalId: submission.externalId,
        message: result.message,
        messageId: result.messageId,
        deliveryStatus: result.deliveryStatus,
      })
    }

    return jsonWithCors(request, {
      success: true,
      submissionId: submission.id,
      externalId: submission.externalId,
      message: "Submission already exists and welcome message was already sent",
      messageId: submission.welcomeMessageId || null,
      deliveryStatus: submission.welcomeDeliveryStatus || null,
    })
  } catch (error) {
    console.error("Webhook processing failed:", error)
    return jsonWithCors(request, { error: "Failed to process webhook" }, { status: 500 })
  }
}