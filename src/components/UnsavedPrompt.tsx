import { useContext, useEffect } from 'react'
import { UNSAFE_NavigationContext } from 'react-router-dom'

const UnsavedPrompt = ({ when, message = '目前有未儲存的變更，是否要離開頁面？' }: { when: boolean; message?: string }) => {
  const { navigator } = useContext(UNSAFE_NavigationContext as unknown as any) as any

  useEffect(() => {
    if (!when) return
    if (!navigator || typeof navigator.block !== 'function') return
    const unblock = navigator.block((tx: any) => {
      const ok = window.confirm(message)
      if (ok) {
        unblock()
        tx.retry()
      }
    })
    return () => unblock()
  }, [navigator, when, message])

  return null
}

export default UnsavedPrompt


