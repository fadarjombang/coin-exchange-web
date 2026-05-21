import { useCallback } from 'react'
import imageCompression from 'browser-image-compression'

/**
 * Hook that provides a `compress` function for client-side image compression.
 * Output: Base64 JPEG string suitable for DB storage.
 *
 * Strategy: maxSizeMB: 0.15, maxWidthOrHeight: 800, JPEG quality 0.6
 */
export function useImageCompress() {
  const compress = useCallback(async (file) => {
    if (!file) throw new Error('No file provided')

    const options = {
      maxSizeMB: 0.15,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.6,
    }

    const compressedBlob = await imageCompression(file, options)

    // Convert to Base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = (e) => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(compressedBlob)
    })
  }, [])

  return { compress }
}
