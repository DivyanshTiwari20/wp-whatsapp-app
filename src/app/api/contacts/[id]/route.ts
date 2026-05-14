import { NextRequest, NextResponse } from "next/server"
import { deleteImportedContact, updateImportedContact } from "@/lib/contacts"
import type { ImportedContactInput } from "@/types"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as ImportedContactInput
    const contact = await updateImportedContact(id, body)
    return NextResponse.json(contact)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update contact"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const deleted = await deleteImportedContact(id)
    if (!deleted) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete contact"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
