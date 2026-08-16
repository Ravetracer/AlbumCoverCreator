import { useEffect, useState } from 'react'

type Status = 'loading' | 'loaded' | 'failed'

// Minimal image loader (avoids pulling an extra dependency). Handles /covers
// paths, object URLs and data URLs. Sets crossOrigin so cached images can be
// exported from the canvas without tainting it.
export function useImage(src: string): [HTMLImageElement | undefined, Status] {
  const [image, setImage] = useState<HTMLImageElement>()
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!src) return
    let cancelled = false
    const img = new window.Image()
    // Same-origin (/covers, object/data URLs) — anonymous is safe and keeps
    // the export untainted.
    img.crossOrigin = 'anonymous'
    setStatus('loading')

    const onLoad = () => {
      if (cancelled) return
      setImage(img)
      setStatus('loaded')
    }
    const onError = () => {
      if (cancelled) return
      setStatus('failed')
    }
    img.addEventListener('load', onLoad)
    img.addEventListener('error', onError)
    img.src = src

    return () => {
      cancelled = true
      img.removeEventListener('load', onLoad)
      img.removeEventListener('error', onError)
    }
  }, [src])

  return [image, status]
}
