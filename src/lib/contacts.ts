import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { ObjectId } from "mongodb"
import { getDatabase } from "@/lib/mongodb"
import { normalizePhoneNumber } from "@/lib/phone"
import type {
  CampaignMessage,
  DeliveryStatus,
  ImportedContact,
  ImportedContactInput,
  MessageStatus,
} from "@/types"

interface ContactDocument extends Omit<ImportedContact, "id" | "createdAt" | "updatedAt"> {
  _id?: ObjectId
  createdAt: Date
  updatedAt: Date
}

interface CampaignDocument extends Omit<CampaignMessage, "id" | "createdAt" | "updatedAt" | "sentAt"> {
  _id?: ObjectId
  sentAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const contactsFilePath = path.join(process.env.LOCAL_STORE_PATH || os.tmpdir(), "whatsapp-imported-contacts.json")
const campaignsFilePath = path.join(process.env.LOCAL_STORE_PATH || os.tmpdir(), "whatsapp-campaign-messages.json")

function shouldUseMongo() {
  const requireMongo = (process.env.REQUIRE_MONGODB || "").toLowerCase()
  if (requireMongo === "1" || requireMongo === "true" || requireMongo === "yes") {
    if (!process.env.MONGODB_URI) {
      throw new Error("MongoDB is required (set MONGODB_URI).")
    }
    return true
  }

  return Boolean(process.env.MONGODB_URI)
}

async function ensureJsonFile(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true })
  try {
    await readFile(filePath, "utf8")
  } catch {
    await writeFile(filePath, "[]", "utf8")
  }
}

async function readJsonFile<T>(filePath: string) {
  await ensureJsonFile(filePath)
  const content = await readFile(filePath, "utf8")
  if (!content.trim()) return [] as T[]
  return JSON.parse(content) as T[]
}

async function writeJsonFile<T>(filePath: string, records: T[]) {
  await ensureJsonFile(filePath)
  await writeFile(filePath, JSON.stringify(records, null, 2), "utf8")
}

async function getContactsCollection() {
  const db = await getDatabase()
  const collection = db.collection<ContactDocument>("imported_contacts")
  await collection.createIndex({ normalizedPhone: 1 }, { unique: true })
  await collection.createIndex({ name: 1 })
  await collection.createIndex({ city: 1 })
  return collection
}

async function getCampaignCollection() {
  const db = await getDatabase()
  const collection = db.collection<CampaignDocument>("campaign_messages")
  await collection.createIndex({ normalizedPhone: 1 })
  await collection.createIndex({ messageId: 1 })
  await collection.createIndex({ templateName: 1, createdAt: -1 })
  return collection
}

function toText(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  return ""
}

function pickRaw(rawFields: Record<string, string> | undefined, candidates: string[]) {
  if (!rawFields) return ""
  const entries = Object.entries(rawFields)
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase()
    const match = entries.find(([key]) => key.toLowerCase().includes(lower))
    if (match?.[1]) return match[1].trim()
  }
  return ""
}

function normalizeContactInput(input: ImportedContactInput) {
  const rawFields = input.rawFields || {}
  const name = toText(input.name) || pickRaw(rawFields, ["name", "full name"]) || "Unknown"
  const phone = toText(input.phone) || pickRaw(rawFields, ["mobile", "phone", "whatsapp", "contact"])
  const normalizedPhone = normalizePhoneNumber(phone)

  return {
    name,
    phone,
    normalizedPhone,
    email: toText(input.email) || pickRaw(rawFields, ["email", "email id", "e-mail"]),
    city: toText(input.city) || pickRaw(rawFields, ["city"]),
    currentLocation: toText(input.currentLocation) || pickRaw(rawFields, ["current location", "location"]),
    attendingDays: toText(input.attendingDays) || pickRaw(rawFields, ["what days", "attend", "day one", "day two"]),
    infoSource: toText(input.infoSource) || pickRaw(rawFields, ["where did you get", "source", "information"]),
    timestamp: toText(input.timestamp) || pickRaw(rawFields, ["timestamp", "time stamp", "submitted"]),
    rawFields,
    source: "manual_import",
  }
}

function mapContact(doc: ContactDocument): ImportedContact {
  return {
    id: doc._id ? doc._id.toString() : doc.normalizedPhone,
    name: doc.name,
    phone: doc.phone,
    normalizedPhone: doc.normalizedPhone,
    email: doc.email,
    city: doc.city,
    currentLocation: doc.currentLocation,
    attendingDays: doc.attendingDays,
    infoSource: doc.infoSource,
    timestamp: doc.timestamp,
    source: doc.source,
    rawFields: doc.rawFields,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

function mapCampaign(doc: CampaignDocument): CampaignMessage {
  return {
    id: doc._id ? doc._id.toString() : doc.messageId || doc.normalizedPhone,
    contactId: doc.contactId,
    name: doc.name,
    phone: doc.phone,
    normalizedPhone: doc.normalizedPhone,
    templateName: doc.templateName,
    status: doc.status,
    deliveryStatus: doc.deliveryStatus,
    messageId: doc.messageId || null,
    error: doc.error || null,
    sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

export async function importContacts(inputs: ImportedContactInput[]) {
  const normalized = inputs
    .map(normalizeContactInput)
    .filter((item) => item.normalizedPhone.length >= 10)

  const now = new Date()

  if (shouldUseMongo()) {
    const collection = await getContactsCollection()
    let created = 0
    let updated = 0

    for (const contact of normalized) {
      const result = await collection.updateOne(
        { normalizedPhone: contact.normalizedPhone },
        {
          $set: {
            ...contact,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      )

      if (result.upsertedCount > 0) created += 1
      else updated += 1
    }

    return {
      totalRows: inputs.length,
      imported: normalized.length,
      skipped: inputs.length - normalized.length,
      created,
      updated,
    }
  }

  const records = await readJsonFile<ImportedContact>(contactsFilePath)
  let created = 0
  let updated = 0

  for (const contact of normalized) {
    const existingIndex = records.findIndex((item) => item.normalizedPhone === contact.normalizedPhone)
    const isoNow = now.toISOString()
    if (existingIndex >= 0) {
      records[existingIndex] = {
        ...records[existingIndex],
        ...contact,
        id: records[existingIndex].id,
        createdAt: records[existingIndex].createdAt,
        updatedAt: isoNow,
      }
      updated += 1
    } else {
      records.push({
        id: randomUUID(),
        ...contact,
        createdAt: isoNow,
        updatedAt: isoNow,
      })
      created += 1
    }
  }

  await writeJsonFile(contactsFilePath, records)
  return {
    totalRows: inputs.length,
    imported: normalized.length,
    skipped: inputs.length - normalized.length,
    created,
    updated,
  }
}

export async function listImportedContacts() {
  if (shouldUseMongo()) {
    const collection = await getContactsCollection()
    const items = await collection.find({}).sort({ updatedAt: -1 }).toArray()
    return items.map(mapContact)
  }

  const records = await readJsonFile<ImportedContact>(contactsFilePath)
  return records.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export async function getImportedContacts(ids?: string[]) {
  if (shouldUseMongo()) {
    const collection = await getContactsCollection()
    const query =
      ids && ids.length > 0
        ? {
            _id: {
              $in: ids.filter(ObjectId.isValid).map((id) => new ObjectId(id)),
            },
          }
        : {}
    const items = await collection.find(query).sort({ updatedAt: -1 }).toArray()
    return items.map(mapContact)
  }

  const records = await readJsonFile<ImportedContact>(contactsFilePath)
  if (!ids || ids.length === 0) return records
  return records.filter((item) => ids.includes(item.id))
}

export async function updateImportedContact(id: string, input: ImportedContactInput) {
  const normalized = normalizeContactInput(input)
  if (normalized.normalizedPhone.length < 10) {
    throw new Error("Valid phone number is required")
  }

  const now = new Date()

  if (shouldUseMongo()) {
    if (!ObjectId.isValid(id)) {
      throw new Error("Invalid contact id")
    }

    const collection = await getContactsCollection()
    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...normalized,
          updatedAt: now,
        },
      },
    )
    const updated = await collection.findOne({ _id: new ObjectId(id) })
    if (!updated) throw new Error("Contact not found")
    return mapContact(updated)
  }

  const records = await readJsonFile<ImportedContact>(contactsFilePath)
  const existing = records.find((item) => item.id === id)
  if (!existing) throw new Error("Contact not found")

  const updated: ImportedContact = {
    ...existing,
    ...normalized,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now.toISOString(),
  }

  await writeJsonFile(
    contactsFilePath,
    records.map((item) => (item.id === id ? updated : item)),
  )
  return updated
}

export async function deleteImportedContact(id: string) {
  if (shouldUseMongo()) {
    if (!ObjectId.isValid(id)) {
      throw new Error("Invalid contact id")
    }

    const collection = await getContactsCollection()
    const result = await collection.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount > 0
  }

  const records = await readJsonFile<ImportedContact>(contactsFilePath)
  const next = records.filter((item) => item.id !== id)
  await writeJsonFile(contactsFilePath, next)
  return next.length !== records.length
}

export async function deleteImportedContacts(ids?: string[]) {
  if (shouldUseMongo()) {
    const collection = await getContactsCollection()
    if (!ids || ids.length === 0) {
      const result = await collection.deleteMany({})
      return result.deletedCount
    }

    const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id))
    if (objectIds.length === 0) return 0
    const result = await collection.deleteMany({ _id: { $in: objectIds } })
    return result.deletedCount
  }

  const records = await readJsonFile<ImportedContact>(contactsFilePath)
  if (!ids || ids.length === 0) {
    await writeJsonFile(contactsFilePath, [])
    return records.length
  }

  const selected = new Set(ids)
  const next = records.filter((item) => !selected.has(item.id))
  await writeJsonFile(contactsFilePath, next)
  return records.length - next.length
}

export async function saveCampaignMessage(input: {
  contactId?: string
  name?: string
  phone: string
  templateName: string
  status: MessageStatus
  deliveryStatus: DeliveryStatus
  messageId?: string | null
  error?: string | null
}) {
  const normalizedPhone = normalizePhoneNumber(input.phone)
  const now = new Date()

  if (shouldUseMongo()) {
    const collection = await getCampaignCollection()
    const result = await collection.insertOne({
      ...input,
      normalizedPhone,
      messageId: input.messageId || null,
      error: input.error || null,
      sentAt: input.status === "sent" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    const saved = await collection.findOne({ _id: result.insertedId })
    if (!saved) throw new Error("Failed to save campaign message")
    return mapCampaign(saved)
  }

  const records = await readJsonFile<CampaignMessage>(campaignsFilePath)
  const saved: CampaignMessage = {
    id: randomUUID(),
    ...input,
    normalizedPhone,
    messageId: input.messageId || null,
    error: input.error || null,
    sentAt: input.status === "sent" ? now.toISOString() : null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  records.push(saved)
  await writeJsonFile(campaignsFilePath, records)
  return saved
}

export async function listCampaignMessages() {
  if (shouldUseMongo()) {
    const collection = await getCampaignCollection()
    const items = await collection.find({}).sort({ createdAt: -1 }).limit(500).toArray()
    return items.map(mapCampaign)
  }

  const records = await readJsonFile<CampaignMessage>(campaignsFilePath)
  return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 500)
}

export async function updateCampaignMessageStatusByMessageId(
  messageId: string,
  deliveryStatus: DeliveryStatus,
  error?: string,
) {
  if (!messageId) return false
  const status: MessageStatus =
    deliveryStatus === "failed"
      ? "failed"
      : deliveryStatus === "pending" || deliveryStatus === "held_for_quality_assessment"
        ? "pending"
        : "sent"

  if (shouldUseMongo()) {
    const collection = await getCampaignCollection()
    const result = await collection.updateOne(
      { messageId },
      {
        $set: {
          status,
          deliveryStatus,
          error: deliveryStatus === "failed" ? error || "Delivery failed" : null,
          updatedAt: new Date(),
        },
      },
    )
    return result.modifiedCount > 0
  }

  const records = await readJsonFile<CampaignMessage>(campaignsFilePath)
  let updated = false
  const next = records.map((item) => {
    if (item.messageId !== messageId) return item
    updated = true
    return {
      ...item,
      status,
      deliveryStatus,
      error: deliveryStatus === "failed" ? error || "Delivery failed" : null,
      updatedAt: new Date().toISOString(),
    }
  })
  if (updated) await writeJsonFile(campaignsFilePath, next)
  return updated
}
