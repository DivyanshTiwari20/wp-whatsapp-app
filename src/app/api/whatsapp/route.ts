import { NextRequest, NextResponse } from "next/server"
import type { SendMessageRequest } from "@/types"
import { sendWhatsAppText } from "@/lib/whatsapp"

export async function POST(request: NextRequest) {
  const body: SendMessageRequest = await request.json()
  const { phone, message } = body

  if (!phone || !message) {
    return NextResponse.json(
      { success: false, message: "Phone and message are required", recipient: phone },
      { status: 400 },
    )
  }

  const result = await sendWhatsAppText(phone, message)
  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}