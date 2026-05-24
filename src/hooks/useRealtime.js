import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to Supabase Realtime postgres_changes.
 *
 * @param {string} table        - Table name to subscribe to
 * @param {string|null} filter  - Optional filter, e.g. 'sesi_tugas_id=eq.xxx'
 * @param {function} callback   - Called on any change event with the payload
 * @param {string} event        - '*' | 'INSERT' | 'UPDATE' | 'DELETE'
 */
export function useRealtime(table, filter = null, callback, event = '*') {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!table) return

    // Task 21: stable channel name (no Date.now()) to prevent duplicate channels
    const channelName = `${table}:${filter || '*'}:${event}`
    const channelConfig = {
      event,
      schema: 'public',
      table,
      ...(filter ? { filter } : {}),
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload) => {
        callbackRef.current(payload)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter, event])
}
