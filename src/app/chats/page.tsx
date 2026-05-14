"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Check, CheckCheck, Clock, Loader2, MessageCircle, RefreshCw, Search, SendHorizonal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ChatMessage, ChatThread } from "@/types"

function formatTime(iso?: string) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata",
  }).format(date)
}

function formatTimeShort(iso?: string) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata",
  }).format(date)
}

function DeliveryIcon({ status, error }: { status?: string; error?: string | null }) {
  if (error || status === "failed") {
    return <AlertCircle className="h-3.5 w-3.5 text-red-300" />
  }
  if (status === "read") {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
  }
  if (status === "delivered") {
    return <CheckCheck className="h-3.5 w-3.5" />
  }
  if (status === "accepted") {
    return <Check className="h-3.5 w-3.5" />
  }
  return <Clock className="h-3 w-3" />
}

export default function ChatsPage() {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null)
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const filteredThreads = useMemo(() => {
    const needle = query.toLowerCase()
    return threads.filter(
      (thread) =>
        (thread.name || "").toLowerCase().includes(needle) ||
        thread.phone.includes(query) ||
        (thread.lastMessage || "").toLowerCase().includes(needle),
    )
  }, [threads, query])

  const loadThreads = useCallback(async (silent = false) => {
    if (!silent && typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('chats_threads_cache')
      const cacheTime = sessionStorage.getItem('chats_threads_time')
      if (cached && cacheTime) {
        if (Date.now() - parseInt(cacheTime, 10) < 5 * 60 * 1000) {
          try {
            const parsed = JSON.parse(cached)
            setThreads(parsed)
            if (!activeThread && parsed.length > 0) {
              setActiveThread(parsed[0])
            }
            return
          } catch (e) {}
        }
      }
    }

    if (!silent) setLoading(true)
    try {
      const response = await fetch("/api/chats")
      const data = await response.json()
      if (Array.isArray(data?.threads)) {
        setThreads(data.threads)
        if (!activeThread && data.threads.length > 0) {
          setActiveThread(data.threads[0])
        }
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('chats_threads_cache', JSON.stringify(data.threads))
          sessionStorage.setItem('chats_threads_time', Date.now().toString())
        }
      }
    } catch (err) {
      console.error("Failed to load chats", err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [activeThread])

  async function loadMessages(thread: ChatThread | null) {
    if (!thread) {
      setMessages([])
      return
    }

    try {
      const response = await fetch(`/api/chats?phone=${encodeURIComponent(thread.normalizedPhone)}`)
      const data = await response.json()
      if (Array.isArray(data?.messages)) setMessages(data.messages)
    } catch (err) {
      console.error("Failed to load messages", err)
    }
  }

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Light polling every 30s — use Refresh button for instant updates
  useEffect(() => {
    loadMessages(activeThread)

    // Mark inbound messages as read when opening a thread
    if (activeThread && activeThread.unreadCount > 0) {
      fetch("/api/chats/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: activeThread.normalizedPhone }),
      }).then(() => {
        // Clear badge in local state immediately
        setThreads((prev) =>
          prev.map((t) =>
            t.normalizedPhone === activeThread.normalizedPhone ? { ...t, unreadCount: 0 } : t,
          ),
        )
      }).catch(() => {})
    }

    const intervalId = setInterval(() => {
      loadThreads(true)
      if (activeThread) loadMessages(activeThread)
    }, 30000)

    return () => clearInterval(intervalId)
  }, [activeThread, loadThreads])

  async function sendReply() {
    if (!activeThread || !draft.trim()) return
    const text = draft.trim()

    // Optimistically add the message to UI immediately
    const optimisticMessage: ChatMessage = {
      id: `pending-${Date.now()}`,
      phone: activeThread.phone,
      normalizedPhone: activeThread.normalizedPhone,
      contactName: activeThread.name,
      direction: "outbound",
      type: "text",
      text,
      deliveryStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMessage])
    setDraft("")

    setSending(true)
    setError("")
    try {
      const response = await fetch("/api/chats/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: activeThread.phone,
          contactName: activeThread.name,
          text,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        // Update the optimistic message to show error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMessage.id
              ? { ...m, deliveryStatus: "failed" as const, error: data?.error || data?.result?.message || "Send failed" }
              : m,
          ),
        )
        setError(data?.error || data?.result?.message || "Send failed")
      } else {
        // Replace optimistic message with the real one from server
        if (data?.message) {
          setMessages((prev) => prev.map((m) => (m.id === optimisticMessage.id ? data.message : m)))
        }
        // Silently refresh threads to update last message
        loadThreads(true)
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMessage.id
            ? { ...m, deliveryStatus: "failed" as const, error: "Network error — message not sent" }
            : m,
        ),
      )
      setError(err instanceof Error ? err.message : "Send failed")
    } finally {
      setSending(false)
    }
  }

  // Group messages by date for a WhatsApp-like date separator
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = []
    let currentDate = ""
    for (const msg of messages) {
      const msgDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : ""
      if (msgDate !== currentDate) {
        currentDate = msgDate
        groups.push({ date: msgDate, messages: [msg] })
      } else {
        groups[groups.length - 1].messages.push(msg)
      }
    }
    return groups
  }, [messages])

  function formatDateLabel(dateStr: string) {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return "Today"
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday"

    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata",
    }).format(date)
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Chats</h1>
            <p className="mt-1 text-sm text-slate-500">Real-time WhatsApp conversations. Send and receive messages here.</p>
          </div>
          <Button variant="outline" onClick={() => loadThreads()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button className="ml-auto text-xs font-medium underline" onClick={() => setError("")}>Dismiss</button>
          </div>
        ) : null}

        <Card className="grid min-h-[680px] overflow-hidden border-0 shadow-sm lg:grid-cols-[360px_1fr]">
          {/* Thread List */}
          <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
            <div className="border-b p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Search conversations..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[612px] overflow-auto">
              {filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
                  <MessageCircle className="h-9 w-9 text-slate-300" />
                  <p className="mt-3 text-sm font-medium">No conversations yet</p>
                  <p className="mt-1 text-sm text-slate-500">When someone messages your WhatsApp Business number, conversations will appear here.</p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const active = activeThread?.normalizedPhone === thread.normalizedPhone
                  return (
                    <button
                      key={thread.normalizedPhone}
                      className={cn(
                        "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition",
                        active ? "bg-[#eef4ff]" : "bg-white hover:bg-slate-50",
                      )}
                      onClick={() => setActiveThread(thread)}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                        {(thread.name || thread.phone).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold">{thread.name || thread.phone}</p>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatTimeShort(thread.lastMessageAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{thread.phone}</p>
                        <p className="mt-1 truncate text-sm text-slate-600">{thread.lastMessage}</p>
                      </div>
                      {thread.unreadCount > 0 && (
                        <span className="mt-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-bold text-white">
                          {thread.unreadCount}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          {/* Chat Area */}
          <section className="flex min-h-[680px] flex-col" style={{ background: "linear-gradient(180deg, #efeae2 0%, #ddd6cc 100%)" }}>
            {activeThread ? (
              <>
                {/* Contact Header */}
                <div className="flex items-center justify-between border-b bg-[#f0f2f5] px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-semibold text-[#54656f]">
                      {(activeThread.name || activeThread.phone).slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#111b21]">{activeThread.name || activeThread.phone}</p>
                      <p className="text-xs text-[#667781]">{activeThread.phone}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-white/80">{messages.length} messages</Badge>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 space-y-1 overflow-auto px-4 py-3 sm:px-8 md:px-16">
                  {groupedMessages.map((group) => (
                    <div key={group.date}>
                      {/* Date Separator */}
                      <div className="my-3 flex items-center justify-center">
                        <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-medium text-[#54656f] shadow-sm">
                          {formatDateLabel(group.date)}
                        </span>
                      </div>

                      {group.messages.map((message) => {
                        const outbound = message.direction === "outbound"
                        const isFailed = message.deliveryStatus === "failed" || !!message.error

                        return (
                          <div key={message.id} className={cn("mb-1 flex", outbound ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "relative max-w-[85%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[65%]",
                                outbound
                                  ? isFailed
                                    ? "rounded-tr-none bg-red-100 text-red-900"
                                    : "rounded-tr-none bg-[#d9fdd3] text-[#111b21]"
                                  : "rounded-tl-none bg-white text-[#111b21]",
                              )}
                            >
                              {/* Template label */}
                              {message.type === "template" && message.templateName ? (
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                                  📋 Template: {message.templateName}
                                </p>
                              ) : null}

                              <p className="text-[13.5px] leading-[19px] whitespace-pre-wrap">{message.text}</p>

                              {/* Timestamp + delivery status */}
                              <div className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", isFailed ? "text-red-500" : "text-[#667781]")}>
                                <span>{formatTimeShort(message.createdAt)}</span>
                                {outbound && <DeliveryIcon status={message.deliveryStatus} error={message.error} />}
                              </div>

                              {/* Error message */}
                              {isFailed && message.error ? (
                                <p className="mt-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-600">
                                  ⚠ {message.error}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="border-t bg-[#f0f2f5] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-lg border-0 bg-white shadow-sm"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          sendReply()
                        }
                      }}
                    />
                    <Button
                      onClick={sendReply}
                      disabled={sending || !draft.trim()}
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-full bg-[#00a884] hover:bg-[#008f72]"
                    >
                      {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="rounded-full bg-white/60 p-6">
                  <MessageCircle className="h-16 w-16 text-[#00a884]/40" />
                </div>
                <p className="mt-4 text-lg font-medium text-[#41525d]">WhatsApp Business Chats</p>
                <p className="mt-2 max-w-sm text-sm text-[#667781]">
                  Select a conversation from the sidebar to view messages. When someone messages your WhatsApp Business number, their messages will show up here and you can reply directly.
                </p>
              </div>
            )}
          </section>
        </Card>
      </div>
    </main>
  )
}
