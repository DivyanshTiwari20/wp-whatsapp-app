import { NextResponse } from "next/server"
import type { FormSubmission, WPFormsEntry } from "@/types"

export async function GET() {
  const wpApiUrl = process.env.WORDPRESS_API_URL
  
  if (!wpApiUrl) {
    return NextResponse.json(
      { error: "WordPress API URL not configured. Set WORDPRESS_API_URL in .env" },
      { status: 500 }
    )
  }

  try {
    const formId = process.env.WORDFORM_FORM_ID || ""
    const endpoint = formId 
      ? `${wpApiUrl}wpforms/v1/entries/${formId}`
      : `${wpApiUrl}wp-json/wp/v2/posts`
    
    const response = await fetch(endpoint, {
      headers: {
        "Authorization": process.env.WORDPRESS_AUTH_TOKEN 
          ? `Bearer ${process.env.WORDPRESS_AUTH_TOKEN}`
          : "",
      },
    })

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const data = await response.json()
    
    const submissions: FormSubmission[] = Array.isArray(data) 
      ? data.map((entry: WPFormsEntry | any) => {
          const fields = entry.fields || {}
          
          const getFieldValue = (fieldNames: string[]): string => {
            for (const fieldName of fieldNames) {
              const field = Object.values(fields).find(
                (f: any) => f.name?.toLowerCase().includes(fieldName.toLowerCase())
              )
              if (field && (field as any).value) return (field as any).value
            }
            return ""
          }

          return {
            id: entry.entry_id || entry.id || Math.random(),
            name: getFieldValue(['name', 'full name', 'first name']) || "Unknown",
            phone: getFieldValue(['phone', 'mobile', 'tel', 'contact']) || "",
            email: getFieldValue(['email', 'e-mail']) || "",
            city: getFieldValue(['city', 'location', 'town', 'place']) || "",
            gender: getFieldValue(['gender', 'sex']) || "",
          }
        }).filter((entry: FormSubmission) => entry.phone)
      : []

    return NextResponse.json(submissions)
  } catch (error) {
    console.error("WordPress API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch WordPress data" },
      { status: 500 }
    )
  }
}
