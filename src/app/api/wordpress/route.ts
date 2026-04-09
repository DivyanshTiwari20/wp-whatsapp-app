import { NextResponse } from "next/server"
import { normalizeWordPressPayload } from "@/lib/wordpress"
import { listSubmissions, upsertSubmission } from "@/lib/submissions"

export async function GET() {
  const wpApiUrl = process.env.WORDPRESS_API_URL

  if (!wpApiUrl) {
    return NextResponse.json(
      { error: "WordPress API URL not configured. Set WORDPRESS_API_URL in .env" },
      { status: 500 },
    )
  }

  try {
    const formId = process.env.WORDFORM_FORM_ID || ""
    const endpoint = formId ? `${wpApiUrl}wpforms/v1/entries/${formId}` : `${wpApiUrl}wp-json/wp/v2/posts`

    const response = await fetch(endpoint, {
      headers: {
        Authorization: process.env.WORDPRESS_AUTH_TOKEN
          ? `Bearer ${process.env.WORDPRESS_AUTH_TOKEN}`
          : "",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const data = await response.json()

    if (Array.isArray(data)) {
      for (const entry of data) {
        const normalized = normalizeWordPressPayload(entry)
        if (!normalized.phone) continue
        await upsertSubmission(normalized, entry)
      }
    }

    const submissions = await listSubmissions()
    return NextResponse.json(submissions)
  } catch (error) {
    console.error("WordPress API error:", error)
    return NextResponse.json({ error: "Failed to fetch WordPress data" }, { status: 500 })
  }
}