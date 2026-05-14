import { NextRequest, NextResponse } from "next/server"
import { importContacts } from "@/lib/contacts"
import type { ImportedContactInput } from "@/types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rows = Array.isArray(body?.rows) ? (body.rows as ImportedContactInput[]) : []

    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows supplied for import" }, { status: 400 })
    }

    const result = await importContacts(rows)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Contact import failed:", error)
    return NextResponse.json({ error: "Contact import failed" }, { status: 500 })
  }
}
