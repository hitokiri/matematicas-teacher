import type { LucideIcon } from 'lucide-react'

/** Icono decorativo de la interfaz: mide lo mismo que el texto y toma su color. El nombre accesible lo da la etiqueta del boton. */
export default function Ico({ as: Icon }: { as: LucideIcon }) {
  return <Icon className="icon" size="1em" aria-hidden="true" />
}
