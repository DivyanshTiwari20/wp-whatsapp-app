import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { ObjectId } from "mongodb"
import { getDatabase } from "@/lib/mongodb"
import { normalizePhoneNumber } from "@/lib/phone"
import type { ChatMessage, ChatThread, DeliveryStatus } from "@/types"

interface ChatDocument extends Omit<ChatMessage, "id" | "createdAt" | "updatedAt"> {
  _id?: ObjectId
  createdAt: Date
  updatedAt: Date
}

const chatsFilePath = path.join(process.env.LOCAL_STORE_PATH || os.tmpdir(), "whatsapp-chat-messages.json")

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

async function getChatsCollection() {
  const db = await getDatabase()
  const collection = db.collection<ChatDocument>("chat_messages")
  await collection.createIndex({ normalizedPhone: 1, createdAt: -1 })
  await collection.createIndex({ messageId: 1 })
  return collection
}

function mapChat(doc: ChatDocument): ChatMessage {
  return {
    id: doc._id ? doc._id.toString() : doc.messageId || `${doc.normalizedPhone}-${doc.createdAt.toISOString()}`,
    phone: doc.phone,
    normalizedPhone: doc.normalizedPhone,
    contactName: doc.contactName,
    direction: doc.direction,
    type: doc.type,
    text: doc.text,
    templateName: doc.templateName,
    messageId: doc.messageId || null,
    deliveryStatus: doc.deliveryStatus,
    error: doc.error || null,
    isRead: (doc as unknown as Record<string, unknown>).isRead === true,
    rawPayload: doc.rawPayload,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

export function threadFromMessages(messages: ChatMessage[]): ChatThread[] {
  const map = new Map<string, ChatThread>()

  for (const message of messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
    const thread = map.get(message.normalizedPhone) || {
      normalizedPhone: message.normalizedPhone,
      phone: message.phone,
      name: message.contactName,
      unreadCount: 0,
      totalMessages: 0,
    }

    thread.phone = message.phone || thread.phone
    thread.name = message.contactName || thread.name
    thread.lastMessage = message.text
    thread.lastMessageAt = message.createdAt
    thread.totalMessages += 1
    if (message.direction === "inbound" && !message.isRead) thread.unreadCount += 1
    map.set(message.normalizedPhone, thread)
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime(),
  )
}

export async function saveChatMessage(input: {
  phone: string
  contactName?: string
  direction: "inbound" | "outbound"
  type: "text" | "template" | "unknown"
  text: string
  templateName?: string
  messageId?: string | null
  deliveryStatus?: DeliveryStatus
  error?: string | null
  rawPayload?: unknown
}) {
  const normalizedPhone = normalizePhoneNumber(input.phone)
  const now = new Date()

  if (shouldUseMongo()) {
    const collection = await getChatsCollection()
    const result = await collection.insertOne({
      ...input,
      normalizedPhone,
      messageId: input.messageId || null,
      deliveryStatus: input.deliveryStatus || "pending",
      error: input.error || null,
      createdAt: now,
      updatedAt: now,
    })
    const saved = await collection.findOne({ _id: result.insertedId })
    if (!saved) throw new Error("Failed to save chat message")
    return mapChat(saved)
  }

  const records = await readJsonFile<ChatMessage>(chatsFilePath)
  const saved: ChatMessage = {
    id: randomUUID(),
    ...input,
    normalizedPhone,
    messageId: input.messageId || null,
    deliveryStatus: input.deliveryStatus || "pending",
    error: input.error || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  records.push(saved)
  await writeJsonFile(chatsFilePath, records)
  return saved
}

export async function listChatMessages(phone?: string) {
  const normalizedPhone = phone ? normalizePhoneNumber(phone) : ""

  if (shouldUseMongo()) {
    const collection = await getChatsCollection()
    const query = normalizedPhone ? { normalizedPhone } : {}
    const items = await collection.find(query).sort({ createdAt: 1 }).limit(1000).toArray()
    return items.map(mapChat)
  }

  const records = await readJsonFile<ChatMessage>(chatsFilePath)
  return records
    .filter((item) => !normalizedPhone || item.normalizedPhone === normalizedPhone)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-1000)
}

export async function listChatThreads() {
  const messages = await listChatMessages()
  return threadFromMessages(messages)
}

export async function updateChatMessageStatusByMessageId(
  messageId: string,
  deliveryStatus: DeliveryStatus,
  error?: string,
) {
  if (!messageId) return false

  if (shouldUseMongo()) {
    const collection = await getChatsCollection()
    const result = await collection.updateOne(
      { messageId },
      {
        $set: {
          deliveryStatus,
          error: deliveryStatus === "failed" ? error || "Delivery failed" : null,
          updatedAt: new Date(),
        },
      },
    )
    return result.modifiedCount > 0
  }

  const records = await readJsonFile<ChatMessage>(chatsFilePath)
  let updated = false
  const next = records.map((item) => {
    if (item.messageId !== messageId) return item
    updated = true
    return {
      ...item,
      deliveryStatus,
      error: deliveryStatus === "failed" ? error || "Delivery failed" : null,
      updatedAt: new Date().toISOString(),
    }
  })
  if (updated) await writeJsonFile(chatsFilePath, next)
  return updated
}

export async function markAsRead(phone: string) {
  const normalizedPhone = phone ? normalizePhoneNumber(phone) : ""
  if (!normalizedPhone) return 0

  if (shouldUseMongo()) {
    const collection = await getChatsCollection()
    const result = await collection.updateMany(
      { normalizedPhone, direction: "inbound", isRead: { $ne: true } },
      { $set: { isRead: true, updatedAt: new Date() } },
    )
    return result.modifiedCount
  }

  const records = await readJsonFile<ChatMessage>(chatsFilePath)
  let count = 0
  const next = records.map((item) => {
    if (item.normalizedPhone === normalizedPhone && item.direction === "inbound" && !item.isRead) {
      count += 1
      return { ...item, isRead: true, updatedAt: new Date().toISOString() }
    }
    return item
  })
  if (count > 0) await writeJsonFile(chatsFilePath, next)
  return count
}
