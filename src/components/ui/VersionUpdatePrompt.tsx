import React, { useEffect, useState, useRef } from 'react'
import { RefreshCw, X } from 'lucide-react'

export default function VersionUpdatePrompt() {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const initialScriptHashRef = useRef<string | null>(null)
  const initialBuildTimeRef = useRef<number | null>(null)

  // Function to extract current bundle script hash from document
  const getCurrentScriptHash = (): string | null => {
    const scripts = Array.from(document.querySelectorAll('script[src]'))
    for (const script of scripts) {
      const src = script.getAttribute('src') || ''
      if (src.includes('/assets/index-') || src.includes('/assets/main-')) {
        return src
      }
    }
    return null
  }

  // Check for updates
  const checkForUpdates = async () => {
    try {
      // 1. Check version.json if available
      try {
        const vRes = await fetch(`/version.json?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        })
        if (vRes.ok) {
          const vData = await vRes.json()
          if (vData && vData.buildTime) {
            if (initialBuildTimeRef.current === null) {
              initialBuildTimeRef.current = vData.buildTime
            } else if (vData.buildTime !== initialBuildTimeRef.current) {
              setHasUpdate(true)
              return
            }
          }
        }
      } catch {
        // Fallback to checking index.html
      }

      // 2. Check index.html bundle hash
      const res = await fetch(`/?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      })
      if (!res.ok) return

      const html = await res.text()
      const match = html.match(/src="(\/assets\/(?:index|main)-[^"]+\.js)"/)
      if (match && match[1]) {
        const remoteScript = match[1]
        if (initialScriptHashRef.current && remoteScript !== initialScriptHashRef.current) {
          setHasUpdate(true)
        }
      }
    } catch {
      // Ignore network errors
    }
  }

  useEffect(() => {
    // Record current script hash on initial mount
    initialScriptHashRef.current = getCurrentScriptHash()

    // Fetch initial version.json to establish baseline
    fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data?.buildTime) {
          initialBuildTimeRef.current = data.buildTime
        }
      })
      .catch(() => {})

    // Listen for Vite chunk preload errors (happens when old chunks are purged on new deployment)
    const handlePreloadError = () => {
      setHasUpdate(true)
    }
    window.addEventListener('vite:preloadError', handlePreloadError)

    // Check periodically every 25 seconds
    const interval = setInterval(checkForUpdates, 25000)

    // Check when user switches back to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('vite:preloadError', handlePreloadError)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  if (!hasUpdate || dismissed) return null

  return (
    <div className="fixed bottom-5 inset-x-0 z-[9999] flex justify-center pointer-events-none px-4">
      <div className="pointer-events-auto w-auto max-w-[95vw] sm:max-w-2xl animate-bounce-in font-sarabun bg-slate-900/90 backdrop-blur-md border border-amber-400/40 text-white shadow-xl shadow-black/30 rounded-full px-4 py-1.5 flex items-center justify-between gap-3 sm:gap-4 ring-1 ring-amber-400/20 transition-all">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
          </span>
          <div className="flex items-center gap-2 truncate text-xs sm:text-sm">
            <span className="font-bold text-amber-300 whitespace-nowrap">มีเวอร์ชันใหม่พร้อมใช้งาน!</span>
            <span className="hidden sm:inline text-slate-300 text-xs truncate">ระบบมีการอัปเดต กรุณารีโหลดหน้าเว็บ</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3 text-slate-950 animate-spin" />
            <span>รีโหลด</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors text-xs cursor-pointer"
            title="ปิดการแจ้งเตือน"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
