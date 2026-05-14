import { NextResponse } from "next/server"
import { listCampaignMessages } from "@/lib/contacts"

export async function GET() {
  try {
    const messages = await listCampaignMessages()
    return NextResponse.json(messages)
  } catch (error) {
    console.error("Failed to list campaign messages:", error)
    return NextResponse.json({ error: "Failed to list campaign messages" }, { status: 500 })
  }
}
