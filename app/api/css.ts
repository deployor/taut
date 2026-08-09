// Taut CSS Utilities
// Injects stylesheets, optionally keyed so later calls can replace them

import { updateMonacoTheme } from '../cdn'

const keyed = new Map<string, HTMLStyleElement>()

function drop(element: HTMLStyleElement, key?: string) {
  element.remove()
  if (key !== undefined) keyed.delete(key)
  updateMonacoTheme()
}

/** Add a stylesheet, returning a disposer. A `key` replaces, a null `css` drops */
export function setStyle(css: string | null, key?: string): () => void {
  let element = key === undefined ? undefined : keyed.get(key)

  if (css === null) {
    if (element) drop(element, key)
    return () => {}
  }

  if (!element) {
    element = document.createElement('style')
    element.dataset.tautStyle = key ?? ''
    document.head.appendChild(element)
    if (key !== undefined) keyed.set(key, element)
  }
  element.textContent = css
  updateMonacoTheme()

  const added = element
  return () => drop(added, key)
}
