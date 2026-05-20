/**
 * Next.js Instrumentation Hook
 *
 * This file is loaded once when the Next.js server starts.
 * We use it to kick off the background reminder scheduler so that
 * reminder messages are sent automatically without an external cron.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only start the scheduler on the Node.js server runtime (not edge, not client)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderScheduler } = await import("@/lib/reminder-scheduler")
    startReminderScheduler()
  }
}
