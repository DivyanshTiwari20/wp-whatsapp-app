import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { deleteImportedContacts, listImportedContacts } from "@/lib/contacts"

export async function GET() {
  try {
    const contacts = await listImportedContacts()
    return NextResponse.json(contacts)
  } catch (error) {
    console.error("Failed to list imported contacts:", error)
    return NextResponse.json({ error: "Failed to list imported contacts" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : undefined
    const deleted = await deleteImportedContacts(ids)
    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    console.error("Failed to delete imported contacts:", error)
    return NextResponse.json({ error: "Failed to delete imported contacts" }, { status: 500 })
  }
}
