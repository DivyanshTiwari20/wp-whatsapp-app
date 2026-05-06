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
