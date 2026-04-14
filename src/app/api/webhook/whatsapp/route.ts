import { NextRequest, NextResponse } from "next/server"
import { updateDeliveryStatusByMessageId } from "@/lib/submissions"

interface WhatsAppStatus {
  id?: string
  status?: string
  errors?: Array<{ title?: string; message?: string; code?: number }>
}

function getErrorMessage(status: WhatsAppStatus) {
  const firstError = status.errors?.[0]
  return firstError?.message || firstError?.title || undefined
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

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []

      for (const change of changes) {
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

          if (updated) {
            updates += 1
          }
        }
      }
    }

    return NextResponse.json({ received: true, updates })
  } catch (error) {
    console.error("WhatsApp webhook processing failed:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}