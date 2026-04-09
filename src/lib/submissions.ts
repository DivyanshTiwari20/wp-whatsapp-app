import { mkdir, readFile, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { ObjectId } from "mongodb"
import { getDatabase } from "@/lib/mongodb"
import type { FormSubmission, MessageStatus, NormalizedSubmission } from "@/types"

interface SubmissionDocument {
  _id: ObjectId
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
  createdAt: string
  updatedAt: string
}

const dataFilePath = path.join(process.env.LOCAL_STORE_PATH || os.tmpdir(), "whatsapp-contact-manager-submissions.json")

function shouldUseMongo() {
  return Boolean(process.env.MONGODB_URI)
}

async function getCollection() {
  const db = await getDatabase()
  const collection = db.collection<SubmissionDocument>("submissions")

  await collection.createIndex({ externalId: 1 }, { unique: true })
  await collection.createIndex({ eventAt: 1, reminderStatus: 1 })

  return collection
}

function mapMongoSubmission(doc: SubmissionDocument): FormSubmission {
  return {
    id: doc._id.toString(),
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
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
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
  return JSON.parse(content) as FileSubmissionRecord[]
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
            reminderStatus: normalized.eventAt
              ? existing.reminderStatus === "not_scheduled"
                ? "pending"
                : existing.reminderStatus
              : "not_scheduled",
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
    const updated: FileSubmissionRecord = {
      ...existing,
      name: normalized.name,
      phone: normalized.phone,
      email: normalized.email,
      city: normalized.city,
      gender: normalized.gender,
      eventAt: normalized.eventAt ? normalized.eventAt.toISOString() : null,
      sourcePayload,
      reminderStatus: normalized.eventAt
        ? existing.reminderStatus === "not_scheduled"
          ? "pending"
          : existing.reminderStatus
        : "not_scheduled",
      updatedAt: now,
    }
    records[existingIndex] = updated
    await writeFileStore(records)
    return { submission: mapFileSubmission(updated), wasCreated: false }
  }

  const created: FileSubmissionRecord = {
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
    createdAt: now,
    updatedAt: now,
  }

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

export async function markWelcomeStatus(id: string, success: boolean, errorMessage?: string) {
  if (shouldUseMongo()) {
    const collection = await getCollection()
    const now = new Date()

    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          welcomeStatus: success ? "sent" : "failed",
          welcomeSentAt: success ? now : null,
          welcomeError: success ? null : errorMessage || "Failed to send welcome message",
          updatedAt: now,
        },
      },
    )

    return
  }

  const records = await readFileStore()
  const now = new Date().toISOString()
  const updatedRecords = records.map((item) => {
    if (item.id !== id) return item
    return {
      ...item,
      welcomeStatus: success ? "sent" : "failed",
      welcomeSentAt: success ? now : null,
      welcomeError: success ? null : errorMessage || "Failed to send welcome message",
      updatedAt: now,
    }
  })
  await writeFileStore(updatedRecords)
}

export async function markReminderStatus(id: string, success: boolean, errorMessage?: string) {
  if (shouldUseMongo()) {
    const collection = await getCollection()
    const now = new Date()

    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          reminderStatus: success ? "sent" : "failed",
          reminderSentAt: success ? now : null,
          reminderError: success ? null : errorMessage || "Failed to send reminder",
          updatedAt: now,
        },
      },
    )

    return
  }

  const records = await readFileStore()
  const now = new Date().toISOString()
  const updatedRecords = records.map((item) => {
    if (item.id !== id) return item
    return {
      ...item,
      reminderStatus: success ? "sent" : "failed",
      reminderSentAt: success ? now : null,
      reminderError: success ? null : errorMessage || "Failed to send reminder",
      updatedAt: now,
    }
  })
  await writeFileStore(updatedRecords)
}

export async function markReminderPending(id: string) {
  if (shouldUseMongo()) {
    const collection = await getCollection()

    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          reminderStatus: "pending",
          reminderError: null,
          updatedAt: new Date(),
        },
      },
    )

    return
  }

  const records = await readFileStore()
  const now = new Date().toISOString()
  const updatedRecords = records.map((item) => {
    if (item.id !== id) return item
    return {
      ...item,
      reminderStatus: "pending",
      reminderError: null,
      updatedAt: now,
    }
  })
  await writeFileStore(updatedRecords)
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
