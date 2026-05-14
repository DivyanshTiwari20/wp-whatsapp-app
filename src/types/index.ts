export type MessageStatus = "pending" | "sent" | "failed" | "not_scheduled"
export type DeliveryStatus =
  | "pending"
  | "accepted"
  | "delivered"
  | "read"
  | "failed"
  | "not_scheduled"
  | "held_for_quality_assessment"
  | "unknown"

export interface FormSubmission {
  id: string
  externalId: string
  name: string
  phone: string
  email?: string
  city?: string
  currentCity?: string
  event?: string
  gender?: string
  eventAt?: string | null
  infoSource?: string
  welcomeStatus: MessageStatus
  reminderStatus: MessageStatus
  welcomeSentAt?: string | null
  reminderSentAt?: string | null
  welcomeMessageId?: string | null
  reminderMessageId?: string | null
  welcomeDeliveryStatus?: DeliveryStatus
  reminderDeliveryStatus?: DeliveryStatus
  welcomeDeliveredAt?: string | null
  reminderDeliveredAt?: string | null
  welcomeDeliveryError?: string | null
  reminderDeliveryError?: string | null
  createdAt?: string
  updatedAt?: string
  [key: string]: string | number | null | undefined
}

export interface NormalizedSubmission {
  externalId: string
  name: string
  phone: string
  email?: string
  city?: string
  currentCity?: string
  event?: string
  gender?: string
  eventAt: Date | null
  infoSource?: string
  rawEventValue?: string
}

export interface WordPressField {
  id?: string | number
  key?: string
  name?: string
  label?: string
  value?: string
}

export interface WPFormsEntry {
  entry_id?: number | string
  form_id?: number
  created?: string
  fields?: Record<string, { name?: string; label?: string; value?: string }> | WordPressField[]
}

export interface FilterState {
  city: string
  gender: string
  search: string
  status: string
  eventFrom: string
  eventTo: string
}

export interface City {
  id: string
  name: string
  isActive: boolean
}

export interface Event {
  id: string
  name: string
  cityId: string
  isActive: boolean
  eventDate?: string
}

export interface SendMessageRequest {
  phone: string
  message: string
}

export interface SendMessageResponse {
  success: boolean
  message: string
  recipient: string
  waLink?: string
  messageId?: string
  deliveryStatus?: DeliveryStatus
}

export interface ImportedContact {
  id: string
  name: string
  phone: string
  normalizedPhone: string
  email?: string
  city?: string
  currentLocation?: string
  attendingDays?: string
  infoSource?: string
  timestamp?: string
  source?: string
  rawFields?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface ImportedContactInput {
  name?: string
  phone?: string
  email?: string
  city?: string
  currentLocation?: string
  attendingDays?: string
  infoSource?: string
  timestamp?: string
  rawFields?: Record<string, string>
}

export interface CampaignMessage {
  id: string
  contactId?: string
  name?: string
  phone: string
  normalizedPhone: string
  templateName: string
  status: MessageStatus
  deliveryStatus: DeliveryStatus
  messageId?: string | null
  error?: string | null
  sentAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  phone: string
  normalizedPhone: string
  contactName?: string
  direction: "inbound" | "outbound"
  type: "text" | "template" | "unknown"
  text: string
  templateName?: string
  messageId?: string | null
  deliveryStatus?: DeliveryStatus
  error?: string | null
  rawPayload?: unknown
  createdAt: string
  updatedAt: string
}

export interface ChatThread {
  normalizedPhone: string
  phone: string
  name?: string
  lastMessage?: string
  lastMessageAt?: string
  unreadCount: number
  totalMessages: number
}
