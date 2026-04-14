import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { ObjectId } from "mongodb"
import { getDatabase } from "@/lib/mongodb"
import type { DeliveryStatus, FormSubmission, MessageStatus, NormalizedSubmission } from "@/types"

interface SendMeta {
  messageId?: string | null
  deliveryStatus?: DeliveryStatus
}

interface SubmissionDocument {
  _id?: ObjectId
  externalId: string
  name: string
  phone: string
  email?: string
  city?: string
  gender?: string
  eventAt: Date | null
  sourcePayload: unknown
  welcomeStatus: MessageStatus
  welcomeSentAt: Date | null
  welcomeError: string | null
  reminderStatus: MessageStatus
  reminderSentAt: Date | null
  reminderError: string | null
  welcomeMessageId?: string | null
  reminderMessageId?: string | null
  welcomeDeliveryStatus?: DeliveryStatus
  reminderDeliveryStatus?: DeliveryStatus
  welcomeDeliveredAt?: Date | null
  reminderDeliveredAt?: Date | null
  welcomeDeliveryError?: string | null
  reminderDeliveryError?: string | null
  createdAt: Date
  updatedAt: Date
}

interface FileSubmissionRecord {
  id: string
  externalId: string
  name: string
  phone: string
  email?: string
  city?: string
  gender?: string
  eventAt: string | null
  sourcePayload: unknown
  welcomeStatus: MessageStatus
  welcomeSentAt: string | null
  welcomeError: string | null
  reminderStatus: MessageStatus
  reminderSentAt: string | null
  reminderError: string | null
  welcomeMessageId: string | null
  reminderMessageId: string | null
  welcomeDeliveryStatus: DeliveryStatus
  reminderDeliveryStatus: DeliveryStatus
  welcomeDeliveredAt: string | null
  reminderDeliveredAt: string | null
  welcomeDeliveryError: string | null
  reminderDeliveryError: string | null
  createdAt: string
  updatedAt: string
}

const dataFilePath = path.join(process.env.LOCAL_STORE_PATH || os.tmpdir(), "whatsapp-contact-manager-submissions.json")

function shouldUseMongo() {
  return Boolean(process.env.MONGODB_URI)
}

function defaultDeliveryFromStatus(status: MessageStatus): DeliveryStatus {
  if (status === "sent") return "accepted"
  if (status === "failed") return "failed"
  if (status === "not_scheduled") return "not_scheduled"
  return "pending"
}

function statusFromDelivery(deliveryStatus: DeliveryStatus): MessageStatus {
  if (deliveryStatus === "failed") return "failed"
  if (deliveryStatus === "not_scheduled") return "not_scheduled"
  if (deliveryStatus === "accepted" || deliveryStatus === "delivered" || deliveryStatus === "read") return "sent"
  return "pending"
}

function normalizeDeliveryStatus(rawStatus: string): DeliveryStatus {
  const normalized = (rawStatus || "").toLowerCase()
  if (normalized === "accepted") return "accepted"
  if (normalized === "sent") return "accepted"
  if (normalized === "delivered") return "delivered"
  if (normalized === "read") return "read"
  if (normalized === "failed") return "failed"
  if (normalized === "not_scheduled") return "not_scheduled"
  if (normalized === "pending") return "pending"
  return "unknown"
}

async function getCollection() {
  const db = await getDatabase()
  const collection = db.collection<SubmissionDocument>("submissions")

  await collection.createIndex({ externalId: 1 }, { unique: true })
  await collection.createIndex({ eventAt: 1, reminderStatus: 1 })
  await collection.createIndex({ welcomeMessageId: 1 })
  await collection.createIndex({ reminderMessageId: 1 })

  return collection
}

function mapMongoSubmission(doc: SubmissionDocument): FormSubmission {
  return {
    id: doc._id ? doc._id.toString() : doc.externalId,
    externalId: doc.externalId,
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    city: doc.city,
    gender: doc.gender,
    eventAt: doc.eventAt ? doc.eventAt.toISOString() : null,
    welcomeStatus: doc.welcomeStatus,
    reminderStatus: doc.reminderStatus,
    welcomeSentAt: doc.welcomeSentAt ? doc.welcomeSentAt.toISOString() : null,
    reminderSentAt: doc.reminderSentAt ? doc.reminderSentAt.toISOString() : null,
    welcomeMessageId: doc.welcomeMessageId || null,
    reminderMessageId: doc.reminderMessageId || null,
    welcomeDeliveryStatus: doc.welcomeDeliveryStatus || defaultDeliveryFromStatus(doc.welcomeStatus),
    reminderDeliveryStatus: doc.reminderDeliveryStatus || defaultDeliveryFromStatus(doc.reminderStatus),
    welcomeDeliveredAt: doc.welcomeDeliveredAt ? doc.welcomeDeliveredAt.toISOString() : null,
    reminderDeliveredAt: doc.reminderDeliveredAt ? doc.reminderDeliveredAt.toISOString() : null,
    welcomeDeliveryError: doc.welcomeDeliveryError || null,
    reminderDeliveryError: doc.reminderDeliveryError || null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

function normalizeFileRecord(input: Partial<FileSubmissionRecord> & Pick<FileSubmissionRecord, "id" | "externalId" | "name" | "phone" | "sourcePayload" | "createdAt" | "updatedAt">): FileSubmissionRecord {
  return {
    id: input.id,
    externalId: input.externalId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    city: input.city,
    gender: input.gender,
    eventAt: input.eventAt || null,
    sourcePayload: input.sourcePayload,
    welcomeStatus: input.welcomeStatus || "pending",
    welcomeSentAt: input.welcomeSentAt || null,
    welcomeError: input.welcomeError || null,
    reminderStatus: input.reminderStatus || "pending",
    reminderSentAt: input.reminderSentAt || null,
    reminderError: input.reminderError || null,
    welcomeMessageId: input.welcomeMessageId || null,
    reminderMessageId: input.reminderMessageId || null,
    welcomeDeliveryStatus: input.welcomeDeliveryStatus || defaultDeliveryFromStatus(input.welcomeStatus || "pending"),
    reminderDeliveryStatus: input.reminderDeliveryStatus || defaultDeliveryFromStatus(input.reminderStatus || "pending"),
    welcomeDeliveredAt: input.welcomeDeliveredAt || null,
    reminderDeliveredAt: input.reminderDeliveredAt || null,
    welcomeDeliveryError: input.welcomeDeliveryError || null,
    reminderDeliveryError: input.reminderDeliveryError || null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }
}

function mapFileSubmission(item: FileSubmissionRecord): FormSubmission {
  return {
    id: item.id,
    externalId: item.externalId,
    name: item.name,
    phone: item.phone,
    email: item.email,
    city: item.city,
    gender: item.gender,
    eventAt: item.eventAt,
    welcomeStatus: item.welcomeStatus,
    reminderStatus: item.reminderStatus,
    welcomeSentAt: item.welcomeSentAt,
    reminderSentAt: item.reminderSentAt,
    welcomeMessageId: item.welcomeMessageId,
    reminderMessageId: item.reminderMessageId,
    welcomeDeliveryStatus: item.welcomeDeliveryStatus,
    reminderDeliveryStatus: item.reminderDeliveryStatus,
    welcomeDeliveredAt: item.welcomeDeliveredAt,
    reminderDeliveredAt: item.reminderDeliveredAt,
    welcomeDeliveryError: item.welcomeDeliveryError,
    reminderDeliveryError: item.reminderDeliveryError,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

async function ensureDataFile() {
  const dataDir = path.dirname(dataFilePath)
  await mkdir(dataDir, { recursive: true })
  try {
    await readFile(dataFilePath, "utf8")
  } catch {
    await writeFile(dataFilePath, "[]", "utf8")
  }
}

async function readFileStore() {
  await ensureDataFile()
  const content = await readFile(dataFilePath, "utf8")
  if (!content.trim()) {
    return [] as FileSubmissionRecord[]
  }

  const parsed = JSON.parse(content) as Array<Partial<FileSubmissionRecord>>
  return parsed
    .filter((item) => item.id && item.externalId && item.name && item.phone && item.createdAt && item.updatedAt)
    .map((item) => normalizeFileRecord(item as FileSubmissionRecord))
}

async function writeFileStore(records: FileSubmissionRecord[]) {
  await ensureDataFile()
  await writeFile(dataFilePath, JSON.stringify(records, null, 2), "utf8")
}

export async function upsertSubmission(normalized: NormalizedSubmission, sourcePayload: unknown) {
  if (shouldUseMongo()) {
    const collection = await getCollection()
    const now = new Date()

    const existing = await collection.findOne({ externalId: normalized.externalId })

    if (existing) {
      if (!existing._id) {
        throw new Error("Existing submission missing _id")
      }

      const nextReminderStatus: MessageStatus = normalized.eventAt
        ? existing.reminderStatus === "not_scheduled"
          ? "pending"
          : existing.reminderStatus
        : "not_scheduled"

      await collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: normalized.name,
            phone: normalized.phone,
            email: normalized.email,
            city: normalized.city,
            gender: normalized.gender,
            eventAt: normalized.eventAt,
            sourcePayload,
            updatedAt: now,
            reminderStatus: nextReminderStatus,
            reminderDeliveryStatus: defaultDeliveryFromStatus(nextReminderStatus),
          },
        },
      )

      const updated = await collection.findOne({ _id: existing._id })
      if (!updated) {
        throw new Error("Failed to update submission")
      }

      return { submission: mapMongoSubmission(updated), wasCreated: false }
    }

    const insertResult = await collection.insertOne({
      externalId: normalized.externalId,
      name: normalized.name,
      phone: normalized.phone,
      email: normalized.email,
      city: normalized.city,
      gender: normalized.gender,
      eventAt: normalized.eventAt,
      sourcePayload,
      welcomeStatus: "pending",
      welcomeSentAt: null,
      welcomeError: null,
      reminderStatus: normalized.eventAt ? "pending" : "not_scheduled",
      reminderSentAt: null,
      reminderError: null,
      welcomeMessageId: null,
      reminderMessageId: null,
      welcomeDeliveryStatus: "pending",
      reminderDeliveryStatus: normalized.eventAt ? "pending" : "not_scheduled",
      welcomeDeliveredAt: null,
      reminderDeliveredAt: null,
      welcomeDeliveryError: null,
      reminderDeliveryError: null,
      createdAt: now,
      updatedAt: now,
    })

    const created = await collection.findOne({ _id: insertResult.insertedId })
    if (!created) {
      throw new Error("Failed to create submission")
    }

    return { submission: mapMongoSubmission(created), wasCreated: true }
  }

  const now = new Date().toISOString()
  const records = await readFileStore()
  const existingIndex = records.findIndex((item) => item.externalId === normalized.externalId)

  if (existingIndex >= 0) {
    const existing = records[existingIndex]
    const nextReminderStatus: MessageStatus = normalized.eventAt
      ? existing.reminderStatus === "not_scheduled"
        ? "pending"
        : existing.reminderStatus
      : "not_scheduled"

    const updated: FileSubmissionRecord = normalizeFileRecord({
      ...existing,
      name: normalized.name,
      phone: normalized.phone,
      email: normalized.email,
      city: normalized.city,
      gender: normalized.gender,
      eventAt: normalized.eventAt ? normalized.eventAt.toISOString() : null,
      sourcePayload,
      reminderStatus: nextReminderStatus,
      reminderDeliveryStatus: defaultDeliveryFromStatus(nextReminderStatus),
      updatedAt: now,
    })

    records[existingIndex] = updated
    await writeFileStore(records)
    return { submission: mapFileSubmission(updated), wasCreated: false }
  }

  const created = normalizeFileRecord({
    id: randomUUID(),
    externalId: normalized.externalId,
    name: normalized.name,
    phone: normalized.phone,
    email: normalized.email,
    city: normalized.city,
    gender: normalized.gender,
    eventAt: normalized.eventAt ? normalized.eventAt.toISOString() : null,
    sourcePayload,
    welcomeStatus: "pending",
    welcomeSentAt: null,
    welcomeError: null,
    reminderStatus: normalized.eventAt ? "pending" : "not_scheduled",
    reminderSentAt: null,
    reminderError: null,
    welcomeMessageId: null,
    reminderMessageId: null,
    welcomeDeliveryStatus: "pending",
    reminderDeliveryStatus: normalized.eventAt ? "pending" : "not_scheduled",
    welcomeDeliveredAt: null,
    reminderDeliveredAt: null,
    welcomeDeliveryError: null,
    reminderDeliveryError: null,
    createdAt: now,
    updatedAt: now,
  })

  records.push(created)
  await writeFileStore(records)
  return { submission: mapFileSubmission(created), wasCreated: true }
}

export async function listSubmissions() {
  if (shouldUseMongo()) {
    const collection = await getCollection()
    const items = await collection.find({}).sort({ createdAt: -1 }).toArray()
    return items.map(mapMongoSubmission)
  }

  const records = await readFileStore()
  return records
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(mapFileSubmission)
}

export async function markWelcomeStatus(id: string, success: boolean, errorMessage?: string, meta?: SendMeta) {
  const initialDelivery: DeliveryStatus = success ? meta?.deliveryStatus || "accepted" : "failed"

  if (shouldUseMongo()) {
    if (!ObjectId.isValid(id)) {
      throw new Error("Invalid submission id")
    }

    const collection = await getCollection()
    const now = new Date()

    const updatePayload: Record<string, unknown> = {
      welcomeStatus: success ? "sent" : "failed",
      welcomeSentAt: success ? now : null,
      welcomeError: success ? null : errorMessage || "Failed to send welcome message",
      welcomeMessageId: meta?.messageId || null,
      welcomeDeliveryStatus: initialDelivery,
      welcomeDeliveryError: success ? null : errorMessage || "Failed to send welcome message",
      updatedAt: now,
    }

    if (initialDelivery === "delivered" || initialDelivery === "read") {
      updatePayload.welcomeDeliveredAt = now
    }

    await collection.updateOne({ _id: new ObjectId(id) }, { $set: updatePayload })
    return
  }

  const records = await readFileStore()
  const now = new Date().toISOString()
  const updatedRecords: FileSubmissionRecord[] = records.map((item): FileSubmissionRecord => {
    if (item.id !== id) return item

    return normalizeFileRecord({
      ...item,
      welcomeStatus: success ? "sent" : "failed",
      welcomeSentAt: success ? now : null,
      welcomeError: success ? null : errorMessage || "Failed to send welcome message",
      welcomeMessageId: meta?.messageId || null,
      welcomeDeliveryStatus: initialDelivery,
      welcomeDeliveryError: success ? null : errorMessage || "Failed to send welcome message",
      welcomeDeliveredAt: initialDelivery === "delivered" || initialDelivery === "read" ? now : item.welcomeDeliveredAt,
      updatedAt: now,
    })
  })

  await writeFileStore(updatedRecords)
}

export async function markReminderStatus(id: string, success: boolean, errorMessage?: string, meta?: SendMeta) {
  const initialDelivery: DeliveryStatus = success ? meta?.deliveryStatus || "accepted" : "failed"

  if (shouldUseMongo()) {
    if (!ObjectId.isValid(id)) {
      throw new Error("Invalid submission id")
    }

    const collection = await getCollection()
    const now = new Date()

    const updatePayload: Record<string, unknown> = {
      reminderStatus: success ? "sent" : "failed",
      reminderSentAt: success ? now : null,
      reminderError: success ? null : errorMessage || "Failed to send reminder",
      reminderMessageId: meta?.messageId || null,
      reminderDeliveryStatus: initialDelivery,
      reminderDeliveryError: success ? null : errorMessage || "Failed to send reminder",
      updatedAt: now,
    }

    if (initialDelivery === "delivered" || initialDelivery === "read") {
      updatePayload.reminderDeliveredAt = now
    }

    await collection.updateOne({ _id: new ObjectId(id) }, { $set: updatePayload })
    return
  }

  const records = await readFileStore()
  const now = new Date().toISOString()
  const updatedRecords: FileSubmissionRecord[] = records.map((item): FileSubmissionRecord => {
    if (item.id !== id) return item

    return normalizeFileRecord({
      ...item,
      reminderStatus: success ? "sent" : "failed",
      reminderSentAt: success ? now : null,
      reminderError: success ? null : errorMessage || "Failed to send reminder",
      reminderMessageId: meta?.messageId || null,
      reminderDeliveryStatus: initialDelivery,
      reminderDeliveryError: success ? null : errorMessage || "Failed to send reminder",
      reminderDeliveredAt: initialDelivery === "delivered" || initialDelivery === "read" ? now : item.reminderDeliveredAt,
      updatedAt: now,
    })
  })

  await writeFileStore(updatedRecords)
}

export async function markReminderPending(id: string) {
  if (shouldUseMongo()) {
    if (!ObjectId.isValid(id)) {
      throw new Error("Invalid submission id")
    }

    const collection = await getCollection()

    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          reminderStatus: "pending",
          reminderError: null,
          reminderDeliveryStatus: "pending",
          reminderDeliveryError: null,
          reminderDeliveredAt: null,
          updatedAt: new Date(),
        },
      },
    )

    return
  }

  const records = await readFileStore()
  const now = new Date().toISOString()
  const updatedRecords: FileSubmissionRecord[] = records.map((item): FileSubmissionRecord => {
    if (item.id !== id) return item

    return normalizeFileRecord({
      ...item,
      reminderStatus: "pending",
      reminderError: null,
      reminderDeliveryStatus: "pending",
      reminderDeliveryError: null,
      reminderDeliveredAt: null,
      updatedAt: now,
    })
  })
  await writeFileStore(updatedRecords)
}

export async function updateDeliveryStatusByMessageId(messageId: string, rawStatus: string, errorMessage?: string) {
  if (!messageId) return false

  const deliveryStatus = normalizeDeliveryStatus(rawStatus)

  if (shouldUseMongo()) {
    const collection = await getCollection()
    const now = new Date()

    const matched = await collection.findOne({
      $or: [{ welcomeMessageId: messageId }, { reminderMessageId: messageId }],
    })

    if (!matched || !matched._id) {
      return false
    }

    if (matched.welcomeMessageId === messageId) {
      const payload: Record<string, unknown> = {
        welcomeDeliveryStatus: deliveryStatus,
        welcomeDeliveryError: deliveryStatus === "failed" ? errorMessage || "Delivery failed" : null,
        welcomeStatus: statusFromDelivery(deliveryStatus),
        updatedAt: now,
      }
      if (deliveryStatus === "delivered" || deliveryStatus === "read") {
        payload.welcomeDeliveredAt = now
      }
      await collection.updateOne({ _id: matched._id }, { $set: payload })
      return true
    }

    if (matched.reminderMessageId === messageId) {
      const payload: Record<string, unknown> = {
        reminderDeliveryStatus: deliveryStatus,
        reminderDeliveryError: deliveryStatus === "failed" ? errorMessage || "Delivery failed" : null,
        reminderStatus: statusFromDelivery(deliveryStatus),
        updatedAt: now,
      }
      if (deliveryStatus === "delivered" || deliveryStatus === "read") {
        payload.reminderDeliveredAt = now
      }
      await collection.updateOne({ _id: matched._id }, { $set: payload })
      return true
    }

    return false
  }

  const records = await readFileStore()
  const now = new Date().toISOString()
  let updatedAny = false

  const updatedRecords: FileSubmissionRecord[] = records.map((item): FileSubmissionRecord => {
    if (item.welcomeMessageId === messageId) {
      updatedAny = true
      return normalizeFileRecord({
        ...item,
        welcomeDeliveryStatus: deliveryStatus,
        welcomeDeliveryError: deliveryStatus === "failed" ? errorMessage || "Delivery failed" : null,
        welcomeStatus: statusFromDelivery(deliveryStatus),
        welcomeDeliveredAt: deliveryStatus === "delivered" || deliveryStatus === "read" ? now : item.welcomeDeliveredAt,
        updatedAt: now,
      })
    }

    if (item.reminderMessageId === messageId) {
      updatedAny = true
      return normalizeFileRecord({
        ...item,
        reminderDeliveryStatus: deliveryStatus,
        reminderDeliveryError: deliveryStatus === "failed" ? errorMessage || "Delivery failed" : null,
        reminderStatus: statusFromDelivery(deliveryStatus),
        reminderDeliveredAt: deliveryStatus === "delivered" || deliveryStatus === "read" ? now : item.reminderDeliveredAt,
        updatedAt: now,
      })
    }

    return item
  })

  if (updatedAny) {
    await writeFileStore(updatedRecords)
  }

  return updatedAny
}

export async function getPendingReminderSubmissions(start: Date, end: Date) {
  if (shouldUseMongo()) {
    const collection = await getCollection()
    const items = await collection
      .find({
        eventAt: { $gte: start, $lt: end },
        reminderStatus: "pending",
      })
      .toArray()

    return items.map(mapMongoSubmission)
  }

  const records = await readFileStore()
  const pending = records.filter((item) => {
    if (item.reminderStatus !== "pending") return false
    if (!item.eventAt) return false

    const eventAt = new Date(item.eventAt)
    return eventAt >= start && eventAt < end
  })

  return pending.map(mapFileSubmission)
}