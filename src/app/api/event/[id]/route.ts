import { NextRequest, NextResponse } from "next/server"
import { setEventActive } from "@/lib/events"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { isActive?: unknown }
    const isActive = Boolean(body.isActive)

    const updated = await setEventActive(id, isActive)
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update event"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

