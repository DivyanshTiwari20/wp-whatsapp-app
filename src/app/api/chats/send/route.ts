import { NextRequest, NextResponse } from "next/server"
import { saveChatMessage } from "@/lib/chats"
import { sendWhatsAppText } from "@/lib/whatsapp"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = typeof body?.phone === "string" ? body.phone : ""
    const text = typeof body?.text === "string" ? body.text.trim() : ""
    const contactName = typeof body?.contactName === "string" ? body.contactName : undefined

    if (!phone || !text) {
      return NextResponse.json({ error: "Phone and message text are required" }, { status: 400 })
    }

    const result = await sendWhatsAppText(phone, text)
    const message = await saveChatMessage({
      phone,
      contactName,
      direction: "outbound",
      type: "text",
      text,
      messageId: result.messageId || null,
      deliveryStatus: result.deliveryStatus || (result.success ? "accepted" : "failed"),
      error: result.success ? null : result.message,
    })

    return NextResponse.json({ success: result.success, result, message }, { status: result.success ? 200 : 500 })
  } catch (error) {
    console.error("Failed to send chat message:", error)
    return NextResponse.json({ error: "Failed to send chat message" }, { status: 500 })
  }
}
