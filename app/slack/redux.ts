// Taut Redux Utilities
// Access to Slack's react-redux store, plus read-time state patching

import { getFiberFromNode, reactPromise } from './react'
import { patchModuleExports } from './webpack'

export type SlackStore = {
  getState(): any
  dispatch(action: any): any
  subscribe(cb: () => void): () => void
}

export type StatePatch = (state: any) => any
const statePatches = new Set<StatePatch>()
// Bumped on register/unregister to invalidate each store's getState memo
let statePatchVersion = 0

// Wrap a store's getState so reads flow through statePatches
function wrapGetState(store: SlackStore): void {
  if ((store.getState as any).__tautWrapped) return
  const realGetState = store.getState.bind(store)
  let cachedRaw: any
  let cachedVersion = -1
  let cachedOut: any
  const wrapped = () => {
    const raw = realGetState()
    if (statePatches.size === 0) return raw
    if (raw === cachedRaw && cachedVersion === statePatchVersion)
      return cachedOut
    let out = raw
    for (const patch of statePatches) {
      try {
        out = patch(out)
      } catch {}
    }
    cachedRaw = raw
    cachedVersion = statePatchVersion
    cachedOut = out
    return out
  }
  wrapped.__tautWrapped = true
  store.getState = wrapped
}

// Hook redux's createStore to wrap the getState of every store it creates
patchModuleExports((exports) => {
  if (!exports || typeof exports !== 'object') return
  for (const key of Object.keys(exports)) {
    let value: any
    try {
      value = exports[key]
    } catch {
      continue
    }
    if (typeof value !== 'function' || value.name !== 'createStore') continue

    const originalCreateStore = value
    const hookedCreateStore = (...args: any[]) => {
      const store = originalCreateStore(...args)
      try {
        wrapGetState(store)
      } catch {}
      return store
    }
    const descriptors = Object.getOwnPropertyDescriptors(exports)
    descriptors[key] = {
      value: hookedCreateStore,
      enumerable: true,
      configurable: true,
      writable: true,
    }
    return Object.create(Object.getPrototypeOf(exports), descriptors)
  }
})

let cachedStore: SlackStore | null = null

/** Slack's react-redux store, found via the <Provider> value on the fiber tree (cached) */
export function getReduxStore(): SlackStore | null {
  if (cachedStore) return cachedStore
  const start = document.querySelector('.p-client_container')?.firstElementChild
  if (!start) return null
  for (let fiber = getFiberFromNode(start); fiber; fiber = fiber.return) {
    const value = fiber.memoizedProps?.value
    const store = value?.store ?? value
    if (
      store &&
      typeof store.getState === 'function' &&
      typeof store.subscribe === 'function'
    ) {
      cachedStore = store
      return store
    }
  }
  return null
}

/** Register a read-time state transform */
export function patchState(patch: StatePatch): () => void {
  const update = () => {
    statePatchVersion++
    try {
      getReduxStore()?.dispatch({ type: '@@taut/PATCH_STATE' })
    } catch {}
  }
  statePatches.add(patch)
  update()
  return () => {
    statePatches.delete(patch)
    update()
  }
}

/** Read-time transform of one slice's entries */
export function patchSlice(
  sliceName: string,
  mapEntry: (entry: any, key: string) => any
): () => void {
  const cache = new WeakMap<object, any>()
  return patchState((state) => {
    const slice = state?.[sliceName]
    if (!slice || typeof slice !== 'object') return state
    return {
      ...state,
      [sliceName]: new Proxy(slice, {
        get(target, key) {
          const value = target[key]
          if (
            typeof key === 'symbol' ||
            value === null ||
            typeof value !== 'object'
          )
            return value
          if (!cache.has(value)) cache.set(value, mapEntry(value, key))
          return cache.get(value)
        },
      }),
    }
  })
}

/** Reactively select from the store inside a React render */
export const reduxPromise = (async () => {
  const React = await reactPromise

  function useReduxState<T>(selector: (state: any) => T): T | undefined {
    const store = getReduxStore()
    const selectorRef = React.useRef(selector)
    selectorRef.current = selector
    const subscribe = React.useCallback(
      (cb: () => void) => (store ? store.subscribe(cb) : () => {}),
      [store]
    )
    const getSnapshot = React.useCallback(
      () => (store ? selectorRef.current(store.getState()) : undefined),
      [store]
    )
    return React.useSyncExternalStore(subscribe, getSnapshot)
  }

  return { getStore: getReduxStore, useReduxState, patchState, patchSlice }
})()

export type ReduxAPI = Awaited<typeof reduxPromise>
