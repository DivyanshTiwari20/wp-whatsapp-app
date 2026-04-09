import { createHash } from "crypto"
import type { NormalizedSubmission, WordPressField } from "@/types"

const defaultNameCandidates = ["name", "full name", "first name"]
const defaultPhoneCandidates = ["phone", "mobile", "tel", "contact", "whatsapp"]
const defaultEmailCandidates = ["email", "e-mail"]
const defaultCityCandidates = ["city", "location", "town", "place"]
const defaultGenderCandidates = ["gender", "sex"]

function toSafeString(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  return ""
}

function parseDateFlexible(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const timestamp = Date.parse(trimmed)
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp)
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (dmyMatch) {
    const day = Number(dmyMatch[1])
    const month = Number(dmyMatch[2]) - 1
    const year = Number(dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3])
    const hour = Number(dmyMatch[4] || "0")
    const minute = Number(dmyMatch[5] || "0")

    const date = new Date(Date.UTC(year, month, day, hour, minute))
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  return null
}

function flattenFields(payload: Record<string, unknown>) {
  const list: Array<{ key: string; label: string; value: string }> = []

  const fields = payload.fields
  if (Array.isArray(fields)) {
    for (const field of fields as WordPressField[]) {
      list.push({
        key: toSafeString(field.key || field.id),
        label: toSafeString(field.name || field.label || field.key || field.id),
        value: toSafeString(field.value),
      })
    }
  } else if (fields && typeof fields === "object") {
    for (const [key, raw] of Object.entries(fields as Record<string, unknown>)) {
      if (raw && typeof raw === "object") {
        const rawObj = raw as Record<string, unknown>
        list.push({
          key,
          label: toSafeString(rawObj.name || rawObj.label || key),
          value: toSafeString(rawObj.value),
        })
      }
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (["fields", "meta", "entry", "submission"].includes(key)) continue
    if (value && typeof value === "object") continue

    list.push({
      key,
      label: key,
      value: toSafeString(value),
    })
  }

  return list.filter((item) => item.value)
}

function pickFieldValue(
  flattened: Array<{ key: string; label: string; value: string }>,
  candidates: string[],
) {
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase()
    const match = flattened.find(
      (item) => item.label.toLowerCase().includes(lower) || item.key.toLowerCase().includes(lower),
    )
    if (match?.value) {
      return match.value
    }
  }

  return ""
}

function buildExternalId(payload: Record<string, unknown>, fallbackValues: string[]) {
  const directId = toSafeString(
    payload.entry_id || payload.id || payload.submission_id || payload.lead_id || payload.uuid,
  )

  if (directId) {
    return directId
  }

  const fingerprint = createHash("sha256")
    .update(JSON.stringify(payload))
    .update(fallbackValues.join("|"))
    .digest("hex")

  return fingerprint
}

function getEventCandidates() {
  const configured = process.env.EVENT_DATE_FIELD_CANDIDATES || ""
  const fromEnv = configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  if (fromEnv.length > 0) {
    return fromEnv
  }

  return ["event_date", "event date", "date", "appointment", "booking date"]
}

function detectEventDate(flattened: Array<{ key: string; label: string; value: string }>) {
  const explicitValue = pickFieldValue(flattened, getEventCandidates())
  if (explicitValue) {
    const explicitDate = parseDateFlexible(explicitValue)
    if (explicitDate) {
      return { eventAt: explicitDate, rawEventValue: explicitValue }
    }
  }

  const fallback = flattened.find((item) => {
    const label = item.label.toLowerCase()
    const key = item.key.toLowerCase()
    return /(event|date|booking|appointment)/.test(label) || /(event|date|booking|appointment)/.test(key)
  })

  if (fallback) {
    const fallbackDate = parseDateFlexible(fallback.value)
    if (fallbackDate) {
      return { eventAt: fallbackDate, rawEventValue: fallback.value }
    }
  }

  return { eventAt: null, rawEventValue: "" }
}

export function normalizeWordPressPayload(payload: unknown): NormalizedSubmission {
  const safePayload =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : ({ raw: payload } as Record<string, unknown>)

  const flattened = flattenFields(safePayload)

  const name = pickFieldValue(flattened, defaultNameCandidates) || "Unknown"
  const phone = pickFieldValue(flattened, defaultPhoneCandidates)
  const email = pickFieldValue(flattened, defaultEmailCandidates)
  const city = pickFieldValue(flattened, defaultCityCandidates)
  const gender = pickFieldValue(flattened, defaultGenderCandidates)

  const { eventAt, rawEventValue } = detectEventDate(flattened)

  const externalId = buildExternalId(safePayload, [name, phone, email, rawEventValue])

  return {
    externalId,
    name,
    phone,
    email,
    city,
    gender,
    eventAt,
    rawEventValue,
  }
}