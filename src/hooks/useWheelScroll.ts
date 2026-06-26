import { useRef, useCallback } from 'react'

/**
 * Returns a ref + onWheel handler that converts vertical wheel
 * delta into horizontal scroll for the attached element.
 */
export function useWheelScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  const onWheel = useCallback((e: React.WheelEvent) => {
    const el = ref.current
    if (!el) return
    // Only intercept when the container is actually scrollable horizontally
    if (el.scrollWidth <= el.clientWidth) return
    // Shift+wheel is already horizontal on some platforms — let the browser handle it
    if (e.shiftKey) return

    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
  }, [])

  return { ref, onWheel }
}
