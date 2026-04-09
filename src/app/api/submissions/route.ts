import { NextResponse } from "next/server"
import { listSubmissions } from "@/lib/submissions"

export async function GET() {
  try {
    const submissions = await listSubmissions()
    return NextResponse.json(submissions)
  } catch (error) {
    console.error("Failed to load submissions:", error)
    return NextResponse.json({ error: "Failed to load submissions" }, { status: 500 })
  }
}