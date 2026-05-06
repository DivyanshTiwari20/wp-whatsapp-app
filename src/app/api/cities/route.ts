import { NextRequest, NextResponse } from "next/server"
import { listCities } from "@/lib/cities"
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
    const active = (searchParams.get("active") || "").toLowerCase()
    const onlyActive = active === "1" || active === "true"

    const cities = await listCities({ onlyActive })
    const response = NextResponse.json(cities)
    const headers = getCorsHeaders(request)
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
    return response
  } catch (error) {
    console.error("Failed to list cities:", error)
    const response = NextResponse.json({ error: "Failed to list cities" }, { status: 500 })
    const headers = getCorsHeaders(request)
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
    return response
  }
}

