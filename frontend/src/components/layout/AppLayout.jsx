import { createContext, useContext, useState, useCallback } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileBottomNav from './MobileBottomNav'
import { ToastProvider } from '../ui/Toast'

const TopBarContext = createContext(null)

/**
 * Allows any page to render contextual actions or custom breadcrumb label in the minimal TopBar.
 */
export function useTopBar() {
  const ctx = useContext(TopBarContext)
  if (!ctx) throw new Error('useTopBar must be used within AppLayout')
  return ctx
}

export default function AppLayout({ children }) {
  const [headerMeta, setHeaderMeta]     = useState({ actions: null, title: null })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const setTopBar = useCallback((meta) => {
    setHeaderMeta({ actions: meta?.actions ?? null, title: meta?.title ?? null })
  }, [])

  const clearTopBar = useCallback(() => {
    setHeaderMeta({ actions: null, title: null })
  }, [])

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  return (
    <ToastProvider>
      <TopBarContext.Provider value={{ setTopBar, clearTopBar }}>
        <div className="flex min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
          <Sidebar open={mobileNavOpen} onClose={closeMobileNav} />

          <div className="flex-1 flex flex-col lg:ml-64 min-h-screen min-w-0">
            <TopBar
              actions={headerMeta.actions}
              customTitle={headerMeta.title}
              onOpenMenu={() => setMobileNavOpen(true)}
            />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
              {children}
            </main>
          </div>

          <MobileBottomNav />
        </div>
      </TopBarContext.Provider>
    </ToastProvider>
  )
}
