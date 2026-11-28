import { useState, useEffect, useCallback, useRef } from 'react'

const cacheStore = new Map()
const subscribers = new Set()

export function getCachedValue(key) {
  return cacheStore.get(key)?.data
}

export function setCachedValue(key, data) {
  cacheStore.set(key, { data, updatedAt: Date.now() })
}

export function invalidateQueryCache(prefix = '') {
  if (!prefix) {
    cacheStore.clear()
  } else {
    for (const k of cacheStore.keys()) {
      if (k === prefix || k.startsWith(prefix)) {
        cacheStore.delete(k)
      }
    }
  }
  subscribers.forEach((fn) => fn(prefix))
}

/**
 * Lightweight stale-while-revalidate hook.
 * Returns cached data immediately on tab switches with zero skeleton flash,
 * while revalidating silently in the background.
 */
export function useCachedQuery(key, fetcher, { enabled = true } = {}) {
  const cachedEntry = cacheStore.get(key)
  const [data, setDataState] = useState(() => cachedEntry?.data ?? null)
  const [loading, setLoading] = useState(() => (enabled ? !cachedEntry : false))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useCallback(async ({ forceSkeleton = false } = {}) => {
    if (!enabled || !key) return null
    const hasCached = cacheStore.has(key)
    if (!hasCached || forceSkeleton) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setError(null)
    try {
      const res = await fetcherRef.current()
      const payload = res?.data !== undefined ? res.data : res
      setCachedValue(key, payload)
      setDataState(payload)
      return payload
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [key, enabled])

  useEffect(() => {
    if (!enabled || !key) return
    const existing = cacheStore.get(key)
    if (existing) {
      setDataState(existing.data)
      setLoading(false)
    } else {
      setLoading(true)
    }
    load()
  }, [key, enabled, load])

  useEffect(() => {
    if (!enabled || !key) return
    const onInvalidate = (prefix) => {
      if (!prefix || key === prefix || key.startsWith(prefix)) {
        load()
      }
    }
    subscribers.add(onInvalidate)
    return () => subscribers.delete(onInvalidate)
  }, [key, enabled, load])

  const setData = useCallback((updater) => {
    setDataState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (key) setCachedValue(key, next)
      return next
    })
  }, [key])

  return { data, setData, loading, refreshing, error, reload: load }
}
