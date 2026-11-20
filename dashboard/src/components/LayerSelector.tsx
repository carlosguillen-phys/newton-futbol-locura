import { es } from '../i18n/es'
import { LAYERS, LAYER_INFO } from '../lib/layers'
import type { Layer } from '../types'

export interface LayerSelectorProps {
  active: Layer
  onSelect: (layer: Layer) => void
}

export default function LayerSelector({ active, onSelect }: LayerSelectorProps) {
  return (
    <div role="group" aria-label={es.layers.title} className="flex flex-wrap gap-2">
      {LAYERS.map((layer) => {
        const isActive = layer === active
        return (
          <button
            key={layer}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(layer)}
            className={`rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              isActive ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {LAYER_INFO[layer].name}
          </button>
        )
      })}
    </div>
  )
}
