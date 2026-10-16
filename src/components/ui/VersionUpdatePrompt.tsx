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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[92%] animate-bounce-in font-sarabun">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-amber-400/50 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex items-center justify-between gap-3 sm:gap-4 ring-2 ring-amber-400/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30">
            <RefreshCw className="w-5 h-5 text-slate-950 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-black text-amber-300">มีเวอร์ชันใหม่พร้อมใช้งาน!</h4>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-normal">
              ระบบมีการอัปเดตใหม่ล่าสุด กรุณารีโหลดหน้าเว็บ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => window.location.reload()}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-950" />
            <span>รีโหลดเลย</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors text-sm cursor-pointer"
            title="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
