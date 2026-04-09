import { NextRequest, NextResponse } from "next/server"
import { getReminderMessage } from "@/lib/templates"
import { getPendingReminderSubmissions, markReminderStatus } from "@/lib/submissions"
import { sendReminderWhatsApp } from "@/lib/whatsapp"

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return true
  }

  const cronHeader = request.headers.get("x-cron-secret")
  const authHeader = request.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""

  return cronHeader === expectedSecret || bearer === expectedSecret
}

async function runReminderDispatch() {
  const now = new Date()
  const start = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const end = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  const targets = await getPendingReminderSubmissions(start, end)
  const outcomes: Array<{ submissionId: string; success: boolean; message: string }> = []

  for (const submission of targets) {
    try {
      const message = getReminderMessage({
        name: submission.name,
        eventAt: submission.eventAt ? new Date(submission.eventAt) : null,
      })

      const result = await sendReminderWhatsApp(submission.phone, message)
      await markReminderStatus(submission.id, result.success, result.success ? undefined : result.message)

      outcomes.push({
        submissionId: submission.id,
        success: result.success,
        message: result.message,
      })
    } catch (error) {
      console.error("Reminder send failure:", error)
      await markReminderStatus(submission.id, false, "Unexpected reminder dispatch error")
      outcomes.push({
        submissionId: submission.id,
        success: false,
        message: "Unexpected reminder dispatch error",
      })
    }
  }

  return {
    success: true,
    checkedWindowStart: start.toISOString(),
    checkedWindowEnd: end.toISOString(),
    totalEligible: targets.length,
    sent: outcomes.filter((item) => item.success).length,
    failed: outcomes.filter((item) => !item.success).length,
    outcomes,
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runReminderDispatch()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Reminder run failed:", error)
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}