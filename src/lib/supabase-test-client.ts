import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54421'
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.warn('⚠️ VITE_SUPABASE_SERVICE_ROLE_KEY is not defined. Tests running against protected schemas/RLS might fail.')
}

// Create a Supabase client configured with the service_role key to bypass RLS for setups/cleanups
export const supabaseTestClient = createClient(supabaseUrl, supabaseServiceKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

interface CleanupItem {
  table: string
  id: any
  keyName: string
}

let cleanupQueue: CleanupItem[] = []

/**
 * Register a record's primary key for automatic cleanup after the current test.
 * @param table - The table name
 * @param id - The ID/primary key value to delete
 * @param keyName - The column name of the primary key (default: 'id')
 */
export function registerForCleanup(table: string, id: any, keyName = 'id') {
  cleanupQueue.push({ table, id, keyName })
}

/**
 * Inserts a record using the test client, registers it for auto-cleanup, and returns the inserted record.
 * Useful for seeding test fixtures that must not leak to other tests.
 */
export async function insertTestRecord<T = any>(table: string, data: any, keyName = 'id'): Promise<T> {
  const { data: inserted, error } = await supabaseTestClient
    .from(table)
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to insert test record in "${table}": ${error.message}`)
  }

  registerForCleanup(table, inserted[keyName], keyName)
  return inserted as T
}

/**
 * Deletes all registered test records in reverse-insertion order (to respect foreign key constraints).
 */
export async function cleanUpAll() {
  if (cleanupQueue.length === 0) return

  // Delete in reverse order of insertion
  for (let i = cleanupQueue.length - 1; i >= 0; i--) {
    const { table, id, keyName } = cleanupQueue[i]
    try {
      const { error } = await supabaseTestClient
        .from(table)
        .delete()
        .eq(keyName, id)

      if (error) {
        console.error(`🔴 Auto-cleanup failed for ${table} (${keyName} = ${id}): ${error.message}`)
      }
    } catch (err: any) {
      console.error(`🔴 Auto-cleanup error for ${table} (${keyName} = ${id}): ${err.message}`)
    }
  }

  cleanupQueue = []
}
