import { es } from '../i18n/es'

export interface LoadingOverlayProps {
  visible: boolean
}

/** Indicador de carga que cubre su contenedor (debe tener `relative`), p. ej. el campo. */
export function LoadingOverlay({ visible }: LoadingOverlayProps) {
  if (!visible) return null
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loading-overlay"
      className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-slate-950/60 text-slate-50"
    >
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-50 border-t-transparent"
      />
      <span className="text-sm font-semibold">{es.loading}</span>
    </div>
  )
}
