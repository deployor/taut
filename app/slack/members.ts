// Reads Slack member profiles from the redux store

import { dispatchThunk, getReduxStore, reduxPromise } from './redux'
import { findExportPromise } from './webpack'

export type SlackMember = {
  id?: string
  name?: string
  real_name?: string
  deleted?: boolean
  isUnknown?: boolean
  isNonExistent?: boolean
  profile?: {
    display_name?: string
    real_name?: string
    image_24?: string
    image_48?: string
    image_72?: string
    image_192?: string
    image_512?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

type GetMemberById = (state: any, userId: string) => SlackMember | undefined

// Mirror Slack's name logic (module CD4g `computeDerivedNames`)
const deburr = (s: string): string =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
const lc = (s: string): string => String(s).toLowerCase()

/**
 * return a copy of the `member` object with the given fields
 * replaced
 */
export function modifyMemberObject(
  member: SlackMember,
  edits: {
    /** both display name and real name */
    name?: string
    /** defaults to `name` */
    displayName?: string
    /** defaults to `name` */
    realName?: string
  }
): SlackMember {
  const profile = { ...member.profile }
  const next: SlackMember = { ...member, profile }

  const { name, displayName = name, realName = name } = edits
  if (displayName !== undefined) {
    profile.display_name = displayName
    profile.display_name_normalized = deburr(displayName)
    next._display_name_lc = lc(displayName)
    next._display_name_normalized_lc = deburr(lc(displayName))
  }
  if (realName !== undefined) {
    next.real_name = realName
    profile.real_name = realName
    profile.real_name_normalized = deburr(realName)
    next._real_name_lc = lc(realName)
    next._real_name_normalized_lc = deburr(lc(realName))
  }

  return next
}

/**
 * slack stands a member it hasn't loaded in with a placeholder carrying empty
 * names and a `profile` shared by every other placeholder, so nothing outside
 * here should ever see one
 */
const loaded = (member?: SlackMember): SlackMember | undefined =>
  !member || member.isUnknown === true || member.isNonExistent === true
    ? undefined
    : member

export function getCachedMember(userId: string): SlackMember | undefined {
  return loaded(getReduxStore()?.getState().members?.[userId])
}

const inFlight = new Map<string, Promise<SlackMember | undefined>>()

/** Get a member, asking slack to fetch them if the store hasn't got them yet */
export async function getMember(
  userId: string
): Promise<SlackMember | undefined> {
  const cached = getCachedMember(userId)
  if (cached) return cached

  // slack's thunk skips only ids already in the store, so it fetches once per
  // call rather than once per member
  const pending = inFlight.get(userId)
  if (pending) return pending

  const request = (async () => {
    // resolves once the members are in the store
    try {
      await dispatchThunk('ensureMembersArePresent', {
        memberIds: [userId],
        reason: 'taut',
      })
    } catch {}
    inFlight.delete(userId)
    return getCachedMember(userId)
  })()
  inFlight.set(userId, request)
  return request
}

export const membersPromise = (async () => {
  const { useReduxState } = await reduxPromise
  const findExport = await findExportPromise
  const readMember: GetMemberById =
    findExport(
      (e: any) =>
        typeof e === 'function' && e.meta?.key === 'createSelectorGetMemberById'
    ) ?? ((state, userId) => state.members?.[userId])

  /** Reactively read a member, asking Slack to load them if it hasn't yet */
  function useMember(userId: string): SlackMember | undefined {
    return useReduxState<SlackMember | undefined>((s) =>
      loaded(readMember(s, userId))
    )
  }

  return { getCachedMember, getMember, useMember, modifyMemberObject }
})()

export type MembersAPI = Awaited<typeof membersPromise>
