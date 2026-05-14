import { NextRequest, NextResponse } from "next/server"
import { markAsRead } from "@/lib/chats"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = typeof body?.phone === "string" ? body.phone : ""

    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 })
    }

    const count = await markAsRead(phone)
    return NextResponse.json({ success: true, markedRead: count })
  } catch (error) {
    console.error("Failed to mark as read:", error)
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
  }
}
