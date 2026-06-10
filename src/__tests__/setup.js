import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanUpAll } from '../lib/supabase-test-client'

afterEach(async () => {
  await cleanUpAll()
})
