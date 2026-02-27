export interface FormSubmission {
  id: number
  name: string
  phone: string
  email?: string
  city?: string
  gender?: string
  [key: string]: string | number | undefined
}

export interface WPFormsEntry {
  entry_id: number
  form_id: number
  created: string
  fields: Record<string, {
    name: string
    value: string
  }>
}

export interface FilterState {
  city: string
  gender: string
  search: string
}

export interface SendMessageRequest {
  phone: string
  message: string
}

export interface SendMessageResponse {
  success: boolean
  message: string
  recipient: string
}
