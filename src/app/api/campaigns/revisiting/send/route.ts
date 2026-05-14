import { NextRequest, NextResponse } from "next/server"
import { saveChatMessage } from "@/lib/chats"
import { getImportedContacts, saveCampaignMessage } from "@/lib/contacts"
import { normalizePhoneNumber } from "@/lib/phone"
import { listSubmissions } from "@/lib/submissions"
import { sendTemplateWhatsApp } from "@/lib/whatsapp"

const TEMPLATE_NAME = process.env.WHATSAPP_REVISITING_TEMPLATE_NAME || "rerevisiting_template"

type AudienceSource = "imported" | "wordpress" | "all"

interface AudienceLead {
  id: string
  source: "imported" | "wordpress"
  name: string
  phone: string
  normalizedPhone: string
}

async function getAudienceLeads(source: AudienceSource, leadIds?: string[]) {
  const selected = new Set(leadIds || [])
  const imported = source === "imported" || source === "all" ? await getImportedContacts() : []
  const submissions = source === "wordpress" || source === "all" ? await listSubmissions() : []

  const leads: AudienceLead[] = [
    ...imported.map((contact) => ({
      id: `imported:${contact.id}`,
      source: "imported" as const,
      name: contact.name,
      phone: contact.phone,
      normalizedPhone: contact.normalizedPhone,
    })),
    ...submissions
      .filter((submission) => submission.phone)
      .map((submission) => ({
        id: `wordpress:${submission.id}`,
        source: "wordpress" as const,
        name: submission.name,
        phone: submission.phone,
        normalizedPhone: normalizePhoneNumber(submission.phone),
      })),
  ]

  const filtered = selected.size > 0 ? leads.filter((lead) => selected.has(lead.id)) : leads
  const byPhone = new Map<string, AudienceLead>()

  for (const lead of filtered) {
    if (!lead.normalizedPhone || lead.normalizedPhone.length < 10) continue
    if (!byPhone.has(lead.normalizedPhone)) {
      byPhone.set(lead.normalizedPhone, lead)
    }
  }

  return Array.from(byPhone.values())
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const source: AudienceSource =
      body?.audience === "wordpress" || body?.audience === "all" || body?.audience === "imported"
        ? body.audience
        : "imported"
    const leadIds = Array.isArray(body?.leadIds)
      ? (body.leadIds as string[])
      : Array.isArray(body?.contactIds)
        ? (body.contactIds as string[]).map((id) => `imported:${id}`)
        : undefined
    const leads = await getAudienceLeads(source, leadIds)

    if (leads.length === 0) {
      return NextResponse.json({ error: "No matching leads found to message" }, { status: 400 })
    }

    const outcomes = []

    for (const lead of leads) {
      const fallbackMessage = `Hi ${lead.name || "there"}, we are reconnecting with you from Jashn-e-Adab.`
      const result = await sendTemplateWhatsApp(lead.phone, TEMPLATE_NAME, fallbackMessage)
      const sentThroughApi = result.success && !result.waLink
      const resultMessage = result.waLink
        ? "WhatsApp API credentials missing; message link was generated but not sent through Meta"
        : result.message
      const campaignMessage = await saveCampaignMessage({
        contactId: lead.id,
        name: lead.name,
        phone: lead.phone,
        templateName: TEMPLATE_NAME,
        status: sentThroughApi ? "sent" : "failed",
        deliveryStatus: result.deliveryStatus && sentThroughApi ? result.deliveryStatus : "failed",
        messageId: result.messageId || null,
        error: sentThroughApi ? null : resultMessage,
      })

      await saveChatMessage({
        phone: lead.phone,
        contactName: lead.name,
        direction: "outbound",
        type: "template",
        text: fallbackMessage,
        templateName: TEMPLATE_NAME,
        messageId: result.messageId || null,
        deliveryStatus: result.deliveryStatus && sentThroughApi ? result.deliveryStatus : "failed",
        error: sentThroughApi ? null : resultMessage,
      })

      outcomes.push({
        leadId: lead.id,
        source: lead.source,
        name: lead.name,
        phone: lead.phone,
        success: sentThroughApi,
        message: resultMessage,
        messageId: campaignMessage.messageId,
        deliveryStatus: campaignMessage.deliveryStatus,
      })
    }

    return NextResponse.json({
      success: true,
      templateName: TEMPLATE_NAME,
      audience: source,
      total: outcomes.length,
      sent: outcomes.filter((item) => item.success).length,
      failed: outcomes.filter((item) => !item.success).length,
      outcomes,
    })
  } catch (error) {
    console.error("Revisiting campaign send failed:", error)
    return NextResponse.json({ error: "Revisiting campaign send failed" }, { status: 500 })
  }
}
