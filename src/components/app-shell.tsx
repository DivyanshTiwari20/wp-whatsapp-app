"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { CalendarDays, Database, Home, Menu, MessageCircle, PanelLeftClose, PanelLeftOpen, Send, UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/import-data", label: "Import Data", icon: UploadCloud },
  { href: "/send-message", label: "Send Message", icon: Send },
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/admin/events", label: "Manage Events", icon: CalendarDays },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true
    // Consider mobile screens to be closed by default initially
    if (typeof window !== "undefined" && window.innerWidth < 1280) return false;
    const saved = window.localStorage.getItem("app_sidebar_open")
    return saved ? saved === "true" : true
  })

  function toggleSidebar() {
    setSidebarOpen((current) => {
      window.localStorage.setItem("app_sidebar_open", String(!current))
      return !current
    })
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#15171a]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-sm transition-opacity xl:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-[248px] border-r border-black/5 bg-white/92 px-4 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2">
            {/* <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f6df6] text-sm font-bold text-white">
              J
            </div> */}
            <span className="text-[17px] font-bold tracking-tight text-blue-700">ASKUS STUDIO</span>
          </Link>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidebar} title="Hide sidebar">
            <PanelLeftClose className="h-4 w-4 text-slate-500" />
          </Button>
        </div>

        <nav className="mt-7 space-y-1">
          {/* <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Main</p> */}
          {navItems.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1280) setSidebarOpen(false)
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-[#eef2f7] text-[#111827]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4", active ? "text-[#2f6df6]" : "text-slate-400")} />
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">WhatsApp Manager</p>
              <p className="text-xs text-slate-500 italic">Build by Askus Studio </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Only show floating toggle button on desktop when sidebar is closed */}
      {!sidebarOpen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed left-4 top-4 z-40 hidden h-9 w-9 rounded-lg bg-white shadow-sm xl:inline-flex"
          onClick={toggleSidebar}
          title="Show sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      )}

      <div className={cn("transition-[padding] duration-200", sidebarOpen ? "xl:pl-[248px]" : "xl:pl-0")}>
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur xl:hidden">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f6df6] text-white">J</span>
            Jashn CRM
          </Link>
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <Menu className="h-5 w-5 text-slate-700" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
