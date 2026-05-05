import { NextRequest, NextResponse } from "next/server"
import { listActiveEventsByCityName, listEvents } from "@/lib/events"
import { getCorsHeaders } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 })
  const headers = getCorsHeaders(request)
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const city = (searchParams.get("city") || "").trim()
    const active = (searchParams.get("active") || "").toLowerCase()

    if (city) {
      const events = await listActiveEventsByCityName(city)
      const response = NextResponse.json(events)
      const headers = getCorsHeaders(request)
      Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
      return response
    }

    const onlyActive = active === "1" || active === "true"
    const events = await listEvents({ onlyActive })
    const response = NextResponse.json(events)
    const headers = getCorsHeaders(request)
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
    return response
  } catch (error) {
    console.error("Failed to list events:", error)
    const response = NextResponse.json({ error: "Failed to list events" }, { status: 500 })
    const headers = getCorsHeaders(request)
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
    return response
  }
}

