import { NextRequest, NextResponse } from "next/server"
import type { SendMessageRequest, SendMessageResponse } from "@/types"

export async function POST(request: NextRequest) {
  const body: SendMessageRequest = await request.json()
  const { phone, message } = body

  if (!phone || !message) {
    return NextResponse.json(
      { success: false, message: "Phone and message are required", recipient: phone },
      { status: 400 }
    )
  }

  const phoneNumber = phone.replace(/[^0-9]/g, "")
  const waPhone = phoneNumber.startsWith("91") ? phoneNumber : `91${phoneNumber}`

  const whatsappApiUrl = process.env.WHATSAPP_API_URL
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (whatsappApiUrl && whatsappToken) {
    try {
      const response = await fetch(`${whatsappApiUrl}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: `+${waPhone}`,
          type: "text",
          text: { body: message },
        }),
      })

      const data = await response.json()

      if (data.error) {
        return NextResponse.json({
          success: false,
          message: data.error.message || "Failed to send message",
          recipient: phone,
        })
      }

      return NextResponse.json({
        success: true,
        message: "Message sent successfully",
        recipient: phone,
      })
    } catch (error) {
      console.error("WhatsApp API error:", error)
      return NextResponse.json({
        success: false,
        message: "Failed to send WhatsApp message",
        recipient: phone,
      })
    }
  }

  const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
  
  return NextResponse.json({
    success: true,
    message: "WhatsApp link generated",
    waLink,
    recipient: phone,
  })
}
