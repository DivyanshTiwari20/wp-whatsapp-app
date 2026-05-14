import { NextRequest, NextResponse } from "next/server"
import { listChatMessages, threadFromMessages } from "@/lib/chats"
import { normalizePhoneNumber } from "@/lib/phone"
import { listSubmissions } from "@/lib/submissions"
import { getReminderMessage, getWelcomeMessage } from "@/lib/templates"
import type { ChatMessage, DeliveryStatus, FormSubmission } from "@/types"

function deliveryStatus(status?: DeliveryStatus) {
  if (status) return status
  return "accepted"
}

function historicalSubmissionMessages(submissions: FormSubmission[]): ChatMessage[] {
  const messages: ChatMessage[] = []

  for (const submission of submissions) {
    if (!submission.phone) continue
    const normalizedPhone = normalizePhoneNumber(submission.phone)

    if (submission.welcomeSentAt && submission.welcomeStatus === "sent") {
      const text = getWelcomeMessage({
        name: submission.name,
        eventAt: submission.eventAt ? new Date(submission.eventAt) : null,
      })
      messages.push({
        id: `history-welcome-${submission.id}`,
        phone: submission.phone,
        normalizedPhone,
        contactName: submission.name,
        direction: "outbound",
        type: "template",
        text,
        templateName: "welcome",
        messageId: submission.welcomeMessageId || null,
        deliveryStatus: deliveryStatus(submission.welcomeDeliveryStatus),
        createdAt: submission.welcomeSentAt,
        updatedAt: submission.updatedAt || submission.welcomeSentAt,
      })
    }

    if (submission.reminderSentAt && submission.reminderStatus === "sent") {
      const text = getReminderMessage({
        name: submission.name,
        eventAt: submission.eventAt ? new Date(submission.eventAt) : null,
      })
      messages.push({
        id: `history-reminder-${submission.id}`,
        phone: submission.phone,
        normalizedPhone,
        contactName: submission.name,
        direction: "outbound",
        type: "template",
        text,
        templateName: "reminder",
        messageId: submission.reminderMessageId || null,
        deliveryStatus: deliveryStatus(submission.reminderDeliveryStatus),
        createdAt: submission.reminderSentAt,
        updatedAt: submission.updatedAt || submission.reminderSentAt,
      })
    }
  }

  return messages
}

function mergeMessages(primary: ChatMessage[], history: ChatMessage[]) {
  const seen = new Set(primary.map((message) => message.messageId || message.id))
  const merged = [...primary]

  for (const message of history) {
    const key = message.messageId || message.id
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(message)
  }

  return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get("phone") || undefined
    const [storedMessages, submissions] = await Promise.all([listChatMessages(phone), listSubmissions()])
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : ""
    const history = historicalSubmissionMessages(submissions).filter(
      (message) => !normalizedPhone || message.normalizedPhone === normalizedPhone,
    )
    const messages = mergeMessages(storedMessages, history)

    if (phone) {
      return NextResponse.json({ messages })
    }

    const threads = threadFromMessages(messages)
    return NextResponse.json({ threads })
  } catch (error) {
    console.error("Failed to load chats:", error)
    return NextResponse.json({ error: "Failed to load chats" }, { status: 500 })
  }
}
