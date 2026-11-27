import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from 'framer-motion'
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'

const DEFAULT_MAGNIFICATION = 50
const DEFAULT_DISTANCE = 110
const DEFAULT_PANEL_HEIGHT = 44
const DEFAULT_BASE_SIZE = 34

const DockContext = createContext(undefined)

function DockProvider({ children, value }) {
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>
}

function useDock() {
  const context = useContext(DockContext)
  if (!context) {
    throw new Error('useDock must be used within a DockProvider')
  }
  return context
}

/**
 * Dock — Apple-style spring magnifying toolbar container powered by framer-motion.
 */
function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 170, damping: 14 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
  baseSize = DEFAULT_BASE_SIZE,
}) {
  const mouseX = useMotionValue(Infinity)
  const isHovered = useMotionValue(0)

  const maxHeight = useMemo(() => {
    return Math.max(panelHeight, magnification + 6)
  }, [magnification, panelHeight])

  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight])
  const height = useSpring(heightRow, spring)

  return (
    <motion.div
      style={{ height: panelHeight }}
      className="flex items-center overflow-visible"
    >
      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1)
          mouseX.set(pageX)
        }}
        onMouseLeave={() => {
          isHovered.set(0)
          mouseX.set(Infinity)
        }}
        style={{ height }}
        className={cn(
          'flex w-fit items-center gap-1.5 rounded-2xl bg-[var(--bg-input)]/85 border border-[var(--border-subtle)] px-1.5 shadow-xs',
          className
        )}
        role="toolbar"
        aria-label="Sheet toolbar"
      >
        <DockProvider value={{ mouseX, spring, distance, magnification, baseSize }}>
          {children}
        </DockProvider>
      </motion.div>
    </motion.div>
  )
}

function DockItem({
  children,
  className,
  onClick,
  type = 'button',
  ariaLabel,
  title,
}) {
  const ref = useRef(null)
  const { distance, magnification, mouseX, spring, baseSize } = useDock()
  const isHovered = useMotionValue(0)

  const mouseDistance = useTransform(mouseX, (val) => {
    const domRect = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - domRect.x - domRect.width / 2
  })

  const widthTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseSize, magnification, baseSize]
  )

  const width = useSpring(widthTransform, spring)

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      style={{ width, height: width }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      className={cn(
        'relative inline-flex items-center justify-center rounded-xl transition-colors focus:outline-none',
        className
      )}
    >
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child, { width, isHovered })
          : child
      )}
    </motion.button>
  )
}

function DockLabel({ children, className, isHovered }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isHovered) return
    const unsubscribe = isHovered.on('change', (latest) => {
      setIsVisible(latest === 1)
    })
    return () => unsubscribe()
  }, [isHovered])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 6 }}
          exit={{ opacity: 0, y: 2 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'pointer-events-none hidden sm:block absolute top-full left-1/2 w-fit whitespace-nowrap rounded-lg border border-[#2C333C] bg-[#1E242B] px-2 py-0.5 text-[11px] font-medium text-white shadow-md z-50',
            className
          )}
          role="tooltip"
          style={{ x: '-50%' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DockIcon({ children, className, width }) {
  const fallbackWidth = useMotionValue(DEFAULT_BASE_SIZE)
  const sizeTransform = useTransform(width || fallbackWidth, (val) => Math.max(15, val * 0.46))

  return (
    <motion.div
      style={{ width: sizeTransform, height: sizeTransform }}
      className={cn('flex items-center justify-center', className)}
    >
      {children}
    </motion.div>
  )
}

export { Dock, DockIcon, DockItem, DockLabel }
