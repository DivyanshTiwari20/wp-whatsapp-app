import { NextRequest, NextResponse } from "next/server"
import { setCityActive, updateCity, deleteCity } from "@/lib/cities"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { isActive?: boolean; name?: string }
    
    let updated;
    if (typeof body.isActive === "boolean") {
      updated = await setCityActive(id, body.isActive)
    } else if (typeof body.name === "string") {
      updated = await updateCity(id, body.name)
    } else {
      throw new Error("Invalid update payload")
    }
    
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update city"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteCity(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete city"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
