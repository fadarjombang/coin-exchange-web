import { describe, it, expect } from 'vitest'
import { supabaseTestClient, insertTestRecord, registerForCleanup } from '../lib/supabase-test-client'

describe('Toko CRUD Integration Tests (Supabase Local)', () => {
  it('should successfully create a new toko record', async () => {
    const testToko = {
      kode_toko: 'TEST-CREATE-01',
      nama_toko: 'Toko Test Baru',
      alamat: 'Jl. Test No. 99, Jombang',
      area: 'Jombang Kota',
      as: 'Amir',
      am: 'Budi',
      is_active: true
    }

    // Insert record and register for automatic cleanup
    const inserted = await insertTestRecord('toko', testToko)

    expect(inserted).toBeDefined()
    expect(inserted.id).toBeDefined()
    expect(inserted.kode_toko).toBe(testToko.kode_toko)
    expect(inserted.nama_toko).toBe(testToko.nama_toko)
  })

  it('should successfully read an existing toko record', async () => {
    // 1. Arrange: Insert a record to read
    const testToko = {
      kode_toko: 'TEST-READ-01',
      nama_toko: 'Toko Test Read',
      alamat: 'Jl. Test Read No. 10',
      area: 'Peterongan',
      is_active: true
    }
    const inserted = await insertTestRecord('toko', testToko)

    // 2. Act: Query the record
    const { data: found, error } = await supabaseTestClient
      .from('toko')
      .select('*')
      .eq('id', inserted.id)
      .single()

    // 3. Assert
    expect(error).toBeNull()
    expect(found).toBeDefined()
    expect(found.id).toBe(inserted.id)
    expect(found.kode_toko).toBe(testToko.kode_toko)
  })

  it('should successfully update a toko record', async () => {
    // 1. Arrange: Insert a record to update
    const testToko = {
      kode_toko: 'TEST-UPDATE-01',
      nama_toko: 'Toko Test Sebelum Update',
      alamat: 'Jl. Test Update Lama',
      is_active: true
    }
    const inserted = await insertTestRecord('toko', testToko)

    // 2. Act: Perform update
    const updatedName = 'Toko Test Setelah Update'
    const { data: updated, error } = await supabaseTestClient
      .from('toko')
      .update({ nama_toko: updatedName })
      .eq('id', inserted.id)
      .select()
      .single()

    // 3. Assert
    expect(error).toBeNull()
    expect(updated).toBeDefined()
    expect(updated.nama_toko).toBe(updatedName)
  })

  it('should successfully delete a toko record', async () => {
    // 1. Arrange: Insert a record using standard insert
    const testToko = {
      kode_toko: 'TEST-DELETE-01',
      nama_toko: 'Toko Test Delete',
      alamat: 'Jl. Test Delete',
      is_active: true
    }
    
    // We insert via raw client so we can test the DELETE operation manually
    const { data: inserted, error: insertErr } = await supabaseTestClient
      .from('toko')
      .insert(testToko)
      .select()
      .single()
    
    expect(insertErr).toBeNull()
    
    // In case the delete operation fails, we register the ID for cleanup
    // so it doesn't leak into other tests.
    registerForCleanup('toko', inserted.id)

    // 2. Act: Delete the record
    const { error: deleteErr } = await supabaseTestClient
      .from('toko')
      .delete()
      .eq('id', inserted.id)

    expect(deleteErr).toBeNull()

    // 3. Assert: Verify record is deleted
    const { data: found } = await supabaseTestClient
      .from('toko')
      .select('*')
      .eq('id', inserted.id)
      .maybeSingle()

    expect(found).toBeNull()
  })
})
