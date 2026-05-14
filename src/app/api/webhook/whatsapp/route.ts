import { NextRequest, NextResponse } from "next/server"
import { saveChatMessage, updateChatMessageStatusByMessageId } from "@/lib/chats"
import { updateCampaignMessageStatusByMessageId } from "@/lib/contacts"
import { updateDeliveryStatusByMessageId } from "@/lib/submissions"
import type { DeliveryStatus } from "@/types"

interface WhatsAppStatus {
  id?: string
  status?: string
  errors?: Array<{ title?: string; message?: string; code?: number }>
}

interface WhatsAppInboundMessage {
  id?: string
  from?: string
  type?: string
  text?: { body?: string }
  button?: { text?: string }
  interactive?: {
    button_reply?: { title?: string }
    list_reply?: { title?: string }
  }
}

function getErrorMessage(status: WhatsAppStatus) {
  const firstError = status.errors?.[0]
  return firstError?.message || firstError?.title || undefined
}

function normalizeWebhookStatus(status?: string): DeliveryStatus {
  const normalized = (status || "").toLowerCase()
  if (normalized === "sent") return "accepted"
  if (normalized === "delivered") return "delivered"
  if (normalized === "read") return "read"
  if (normalized === "failed") return "failed"
  if (normalized === "held_for_quality_assessment") return "held_for_quality_assessment"
  return "unknown"
}

function getInboundText(message: WhatsAppInboundMessage) {
  if (message.type === "text" && message.text?.body) return message.text.body
  if (message.button?.text) return message.button.text
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title
  return `[${message.type || "unknown"} message]`
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode")
  const verifyToken = request.nextUrl.searchParams.get("hub.verify_token")
  const challenge = request.nextUrl.searchParams.get("hub.challenge")
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || ""

  if (mode === "subscribe" && verifyToken && expectedToken && verifyToken === expectedToken) {
    return new NextResponse(challenge || "", { status: 200 })
  }

  return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const entries = Array.isArray(payload?.entry) ? payload.entry : []

    let updates = 0
    let inboundMessages = 0

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []

      for (const change of changes) {
        const contacts = Array.isArray(change?.value?.contacts) ? change.value.contacts : []
        const contactNames = new Map<string, string>()
        for (const contact of contacts) {
          if (contact?.wa_id) {
            contactNames.set(contact.wa_id, contact?.profile?.name || "")
          }
        }

        const messages = Array.isArray(change?.value?.messages)
          ? (change.value.messages as WhatsAppInboundMessage[])
          : []

        for (const message of messages) {
          if (!message.from) continue

          await saveChatMessage({
            phone: message.from,
            contactName: contactNames.get(message.from) || undefined,
            direction: "inbound",
            type: message.type === "text" ? "text" : "unknown",
            text: getInboundText(message),
            messageId: message.id || null,
            deliveryStatus: "delivered",
            rawPayload: message,
          })

          inboundMessages += 1
        }

        const statuses = Array.isArray(change?.value?.statuses) ? (change.value.statuses as WhatsAppStatus[]) : []

        for (const statusItem of statuses) {
          if (!statusItem.id || !statusItem.status) {
            continue
          }

          const updated = await updateDeliveryStatusByMessageId(
            statusItem.id,
            statusItem.status,
            getErrorMessage(statusItem),
          )
          const deliveryStatus = normalizeWebhookStatus(statusItem.status)
          const campaignUpdated = await updateCampaignMessageStatusByMessageId(
            statusItem.id,
            deliveryStatus,
            getErrorMessage(statusItem),
          )
          const chatUpdated = await updateChatMessageStatusByMessageId(
            statusItem.id,
            deliveryStatus,
            getErrorMessage(statusItem),
          )

          if (updated || campaignUpdated || chatUpdated) {
            updates += 1
          }
        }
      }
    }

    return NextResponse.json({ received: true, updates, inboundMessages })
  } catch (error) {
    console.error("WhatsApp webhook processing failed:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
