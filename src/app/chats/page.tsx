"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCheck, Loader2, MessageCircle, RefreshCw, Search, SendHorizonal } from "lucide-react"
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

export default function ChatsPage() {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null)
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

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
    if (!silent) setLoading(true)
    try {
      const response = await fetch("/api/chats")
      const data = await response.json()
      if (Array.isArray(data?.threads)) {
        setThreads(data.threads)
        if (!activeThread && data.threads.length > 0) {
          setActiveThread(data.threads[0])
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

  useEffect(() => {
    loadMessages(activeThread)

    const intervalId = setInterval(() => {
      loadThreads(true)
      if (activeThread) loadMessages(activeThread)
    }, 10000)

    return () => clearInterval(intervalId)
  }, [activeThread, loadThreads])

  async function sendReply() {
    if (!activeThread || !draft.trim()) return
    setSending(true)
    setError("")
    try {
      const response = await fetch("/api/chats/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: activeThread.phone,
          contactName: activeThread.name,
          text: draft.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || data?.result?.message || "Send failed")
      setDraft("")
      await loadMessages(activeThread)
      await loadThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed")
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Chats</h1>
            <p className="mt-1 text-sm text-slate-500">API conversations, replies, and outgoing messages in one place.</p>
          </div>
          <Button variant="outline" onClick={() => loadThreads()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <Card className="grid min-h-[680px] overflow-hidden border-0 shadow-sm lg:grid-cols-[360px_1fr]">
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
                  <p className="mt-1 text-sm text-slate-500">Incoming replies from Meta webhooks will appear here.</p>
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
                          <span className="shrink-0 text-[11px] text-slate-400">{thread.totalMessages}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{thread.phone}</p>
                        <p className="mt-1 truncate text-sm text-slate-600">{thread.lastMessage}</p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <section className="flex min-h-[680px] flex-col bg-[#f8fafc]">
            {activeThread ? (
              <>
                <div className="flex items-center justify-between border-b bg-white px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8efff] text-sm font-semibold text-[#245fe2]">
                      {(activeThread.name || activeThread.phone).slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{activeThread.name || activeThread.phone}</p>
                      <p className="text-xs text-slate-500">{activeThread.phone}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{activeThread.totalMessages} messages</Badge>
                </div>

                <div className="flex-1 space-y-3 overflow-auto p-5">
                  {messages.map((message) => {
                    const outbound = message.direction === "outbound"
                    return (
                      <div key={message.id} className={cn("flex", outbound ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-4 py-3 shadow-sm",
                            outbound ? "rounded-br-md bg-[#2f6df6] text-white" : "rounded-bl-md bg-white text-slate-900",
                          )}
                        >
                          <p className="text-sm leading-6">{message.text}</p>
                          {message.type === "template" && message.templateName ? (
                            <p className={cn("mt-1 text-[11px]", outbound ? "text-white/70" : "text-slate-400")}>
                              Template: {message.templateName}
                            </p>
                          ) : null}
                          <div className={cn("mt-2 flex items-center justify-end gap-1 text-[11px]", outbound ? "text-white/75" : "text-slate-400")}>
                            <span>{formatTime(message.createdAt)}</span>
                            {outbound ? <CheckCheck className="h-3.5 w-3.5" /> : null}
                          </div>
                          {message.error ? <p className="mt-1 text-xs text-red-200">{message.error}</p> : null}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t bg-white p-4">
                  <div className="flex gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Type a reply..."
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          sendReply()
                        }
                      }}
                    />
                    <Button onClick={sendReply} disabled={sending || !draft.trim()}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <MessageCircle className="h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium">Select a conversation</p>
                <p className="mt-1 text-sm text-slate-500">Replies and campaign messages will be shown here.</p>
              </div>
            )}
          </section>
        </Card>
      </div>
    </main>
  )
}
