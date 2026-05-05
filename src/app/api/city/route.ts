import { NextRequest, NextResponse } from "next/server"
import { createCity } from "@/lib/cities"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown }
    const name = typeof body.name === "string" ? body.name : ""

    const city = await createCity(name)
    return NextResponse.json(city, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create city"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

