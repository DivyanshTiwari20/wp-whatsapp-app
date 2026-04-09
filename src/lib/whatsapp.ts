import type { SendMessageResponse } from "@/types"

interface SendOptions {
  templateName?: string
  templateLanguage?: string
}

function normalizePhone(phone: string) {
  const phoneNumber = phone.replace(/[^0-9]/g, "")
  return phoneNumber.startsWith("91") ? phoneNumber : `91${phoneNumber}`
}

function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/, "")
}

function getMessagesEndpoint() {
  const explicitEndpoint = process.env.WHATSAPP_MESSAGES_ENDPOINT
  if (explicitEndpoint) {
    return explicitEndpoint
  }

  const base = process.env.WHATSAPP_API_URL
  if (!base) {
    return ""
  }

  if (base.includes("/messages")) {
    return base
  }

  const trimmedBase = trimTrailingSlash(base)
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (phoneNumberId) {
    return `${trimmedBase}/${phoneNumberId}/messages`
  }

  return `${trimmedBase}/messages`
}

export async function sendWhatsAppText(phone: string, message: string): Promise<SendMessageResponse> {
  return sendWhatsAppMessage(phone, message)
}

export async function sendWelcomeWhatsApp(phone: string, fallbackMessage: string) {
  return sendWhatsAppMessage(phone, fallbackMessage, {
    templateName: process.env.WHATSAPP_WELCOME_TEMPLATE_NAME,
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US",
  })
}

export async function sendReminderWhatsApp(phone: string, fallbackMessage: string) {
  return sendWhatsAppMessage(phone, fallbackMessage, {
    templateName: process.env.WHATSAPP_REMINDER_TEMPLATE_NAME,
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US",
  })
}

async function sendWhatsAppMessage(phone: string, message: string, options?: SendOptions): Promise<SendMessageResponse> {
  if (!phone || !message) {
    return {
      success: false,
      message: "Phone and message are required",
      recipient: phone,
    }
  }

  const waPhone = normalizePhone(phone)
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN
  const endpoint = getMessagesEndpoint()

  if (endpoint && whatsappToken) {
    try {
      const payload = options?.templateName
        ? {
            messaging_product: "whatsapp",
            to: waPhone,
            type: "template",
            template: {
              name: options.templateName,
              language: {
                code: options.templateLanguage || "en_US",
              },
            },
          }
        : {
            messaging_product: "whatsapp",
            to: waPhone,
            type: "text",
            text: { body: message },
          }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok || data?.error) {
        return {
          success: false,
          message: data?.error?.message || "Failed to send message",
          recipient: phone,
        }
      }

      return {
        success: true,
        message: "Message accepted by WhatsApp",
        recipient: phone,
      }
    } catch (error) {
      console.error("WhatsApp API error:", error)
      return {
        success: false,
        message: "Failed to send WhatsApp message",
        recipient: phone,
      }
    }
  }

  const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`

  return {
    success: true,
    message: "WhatsApp link generated",
    waLink,
    recipient: phone,
  }
}