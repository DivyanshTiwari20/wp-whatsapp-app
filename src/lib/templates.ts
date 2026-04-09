interface TemplateData {
  name?: string
  eventAt?: Date | null
}

function formatDate(eventAt?: Date | null) {
  if (!eventAt) return ""

  const timezone = process.env.APP_TIMEZONE || "Asia/Kolkata"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: timezone,
  }).format(eventAt)
}

function formatTime(eventAt?: Date | null) {
  if (!eventAt) return ""

  const timezone = process.env.APP_TIMEZONE || "Asia/Kolkata"
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(eventAt)
}

export function renderTemplate(template: string, data: TemplateData) {
  return template
    .replaceAll("{name}", data.name || "there")
    .replaceAll("{event_date}", formatDate(data.eventAt))
    .replaceAll("{event_time}", formatTime(data.eventAt))
}

export function getWelcomeMessage(data: TemplateData) {
  const template =
    process.env.WELCOME_MESSAGE_TEMPLATE ||
    "Hi {name}, welcome. We have received your details."
  return renderTemplate(template, data)
}

export function getReminderMessage(data: TemplateData) {
  const template =
    process.env.REMINDER_MESSAGE_TEMPLATE ||
    "Hi {name}, this is a reminder for your event on {event_date} at {event_time}."
  return renderTemplate(template, data)
}