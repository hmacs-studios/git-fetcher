import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  useEffect(() => {
    const dismissOnOutsideTouch = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target && !target.closest(".toast-surface")) dismiss()
    }
    document.addEventListener("pointerdown", dismissOnOutsideTouch)
    return () => document.removeEventListener("pointerdown", dismissOnOutsideTouch)
  }, [dismiss])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="toast-surface">
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
          </Toast>
        )
      })}
      {/* Updated ToastViewport to have a high z-index */}
      <ToastViewport className="pointer-events-none z-[9999] bottom-0 w-screen max-w-none p-0 pb-[env(safe-area-inset-bottom)]" />
    </ToastProvider>
  )
}
