import { useEffect, useState } from 'react'

/**
 * Renders a stored image Blob.
 *
 * The object URL is created per mount and revoked on unmount, otherwise a long
 * archive list would leak a URL for every row it ever rendered.
 */
export function ReceiptThumb({
  blob,
  className = '',
  zoom,
  rotation,
}: {
  blob: Blob
  className?: string
  zoom?: number
  rotation?: number
}) {
  const [url, setUrl] = useState<string>('')

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  if (!url) return <span className={`block bg-surface-container ${className}`} />

  const transform =
    zoom !== undefined || rotation !== undefined
      ? { transform: `scale(${zoom ?? 1}) rotate(${rotation ?? 0}deg)`, transformOrigin: 'top center' }
      : undefined

  return <img src={url} alt="" className={`object-cover ${className}`} style={transform} />
}
