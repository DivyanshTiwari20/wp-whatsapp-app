export function normalizePhoneNumber(phone: string) {
  const phoneNumber = phone.replace(/[^0-9]/g, "")
  if (phoneNumber.length === 10) {
    return `91${phoneNumber}`
  }
  if (phoneNumber.startsWith("0") && phoneNumber.length === 11) {
    return `91${phoneNumber.substring(1)}`
  }
  return phoneNumber
}
