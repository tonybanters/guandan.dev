import { useState, useEffect } from 'react'

// Detect mobile: small width OR small height (catches landscape phones)
function check_is_mobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || window.innerHeight < 500
}

export function use_is_mobile(): boolean {
  const [is_mobile, set_is_mobile] = useState(check_is_mobile)

  useEffect(() => {
    const handle_resize = () => {
      set_is_mobile(check_is_mobile())
    }

    window.addEventListener('resize', handle_resize)
    return () => window.removeEventListener('resize', handle_resize)
  }, [])

  return is_mobile
}
