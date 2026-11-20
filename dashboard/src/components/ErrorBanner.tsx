import { es } from '../i18n/es'

export interface ErrorBannerProps {
  message: string
  onRetry: () => void
}

/** Banner de error en español con botón "Reintentar". */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      data-testid="error-banner"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-300 bg-red-950 px-4 py-3 text-red-100"
    >
      <p className="text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-950 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        {es.retry}
      </button>
    </div>
  )
}
