import { NextRequest, NextResponse } from "next/server"
import { setEventActive, updateEvent, deleteEvent } from "@/lib/events"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { isActive?: boolean; name?: string; eventDate?: string }
    
    let updated;
    if (typeof body.isActive === "boolean") {
      updated = await setEventActive(id, body.isActive)
    } else if (typeof body.name === "string" || typeof body.eventDate === "string") {
      updated = await updateEvent(id, { 
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.eventDate === "string" ? { eventDate: body.eventDate } : {})
      })
    } else {
      throw new Error("Invalid update payload")
    }
    
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update event"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteEvent(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete event"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
