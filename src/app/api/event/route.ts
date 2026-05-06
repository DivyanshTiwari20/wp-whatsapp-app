import { NextRequest, NextResponse } from "next/server"
import { createEvent } from "@/lib/events"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; cityId?: unknown; eventDate?: unknown }
    const name = typeof body.name === "string" ? body.name : ""
    const cityId = typeof body.cityId === "string" ? body.cityId : ""
    const eventDate = typeof body.eventDate === "string" ? body.eventDate : undefined

    const event = await createEvent({ name, cityId, eventDate })
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create event"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

