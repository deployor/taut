// Shows when someone was last seen on their profile

import { type RtmEvent, TautPlugin, type TautPluginConfig } from '$taut'

type LastSeenConfig = TautPluginConfig & {
  showLastMessage: boolean
  showObservedPresence: boolean
}

type PresenceProps = { member?: { id?: string } }
type SearchResponse = { messages?: { matches?: { ts?: string }[] } }

const SEEN_KEY = 'observed'
const MAX_SEEN = 2000
const UNITS = [
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
] as const

/** the id, unless a bot posted under it with an xoxp */
const human = (msg: RtmEvent | undefined, id: unknown) =>
  msg && typeof id === 'string' && !msg.bot_id && !msg.app_id ? id : undefined

const ACTIVITY: Record<
  string,
  (event: RtmEvent) => string | string[] | undefined
> = {
  // an away also arrives in bulk on subscribe, so only active means "now"
  presence_change: (e) =>
    e.presence === 'active' ? (e.users ?? e.user) : undefined,
  user_typing: (e) => e.user,
  message: (e) =>
    human(e, e.user) ??
    (e.subtype === 'message_changed'
      ? human(e.message, e.message?.edited?.user)
      : undefined),
  reaction_added: (e) => e.user,
  reaction_removed: (e) => e.user,
  pin_added: (e) => e.user,
  pin_removed: (e) => e.user,
  file_shared: (e) => e.user_id,
  sh_room_join: (e) => e.user,
}

function ago(at: number): string {
  const elapsed = Date.now() - at
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, size] of UNITS)
    if (elapsed >= size)
      return format.format(-Math.max(1, Math.floor(elapsed / size)), unit)
  return 'just now'
}

export default class LastSeen extends TautPlugin {
  static readonly id = 'LastSeen'
  static readonly pluginName = 'Last Seen'
  static readonly description =
    'Shows when someone was last seen on their profile'
  static readonly authors = '<@U06UYA5GMB5>, <@U080A3QP42C>'
  static readonly defaultConfig = `
    // Shows when someone was last seen on their profile
    "LastSeen": {
      "enabled": false,
      "showLastMessage": true,
      "showObservedPresence": true
    }
  `

  /** their last visible message in ms */
  private messages = new this.api.Cache<number | null>('last_message', {
    ttl: 6 * 60 * 60 * 1000,
    maxSize: 2000,
  })
  /** when we last saw each person go active, in ms */
  private seen: Record<string, number> = {}
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  private get options(): LastSeenConfig {
    return this.config as LastSeenConfig
  }

  async start() {
    this.seen = await this.api.storage.get<Record<string, number>>(SEEN_KEY, {})
    await this.messages.load()
    if (this.api.signal.aborted) return

    if (this.options.showObservedPresence !== false)
      for (const [type, who] of Object.entries(ACTIVITY))
        this.api.rtm.on(type, (event) => this.sighting(who(event)))

    this.api.patchComponent<PresenceProps>(
      'RimetoProfilePresence',
      (Original) => (props) => {
        const id = props.member?.id
        return (
          <>
            <Original {...props} />
            {id ? <this.LastSeenLine userId={id} /> : null}
          </>
        )
      }
    )

    this.api.setStyle(`
      .taut-last-seen {
        display: block;
        margin-top: 2px;
        font-size: 13px;
        color: rgba(var(--sk_foreground_high_solid, 134, 134, 134), 1);
      }
    `)

    this.log('Started')
  }

  stop(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
  }

  private LastSeenLine = ({ userId }: { userId: string }) => {
    const [lastMessage, setLastMessage] = React.useState<number | null>(
      () => this.messages.get(userId) ?? null
    )
    const presence = this.api.redux.useReduxState(
      (state) => state.presence?.[userId]?.presence
    )

    React.useEffect(() => {
      if (this.options.showLastMessage === false) return
      let live = true
      this.lastMessageOf(userId)
        .then((at) => {
          if (live) setLastMessage(at)
        })
        .catch(() => {})
      return () => {
        live = false
      }
    }, [userId])

    if (presence === 'active') return null
    const observed =
      this.options.showObservedPresence === false
        ? undefined
        : this.seen[userId]
    const at = Math.max(observed ?? 0, lastMessage ?? 0)
    if (!at) return null

    return (
      <span className="taut-last-seen" title={new Date(at).toLocaleString()}>
        {`Last seen ${ago(at)}`}
      </span>
    )
  }

  private sighting(who: string | string[] | undefined) {
    if (!who) return
    const now = Date.now()
    for (const id of typeof who === 'string' ? [who] : who) this.seen[id] = now
    this.save()
  }

  private save() {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      const ids = Object.keys(this.seen)
      if (ids.length > MAX_SEEN) {
        ids.sort((a, b) => (this.seen[a] ?? 0) - (this.seen[b] ?? 0))
        for (const id of ids.slice(0, ids.length - MAX_SEEN))
          delete this.seen[id]
      }
      void this.api.storage.set(SEEN_KEY, this.seen)
    }, 2000)
  }

  private lastMessageOf(userId: string) {
    return this.messages.fetch(userId, async () => {
      const res = await this.api.userAPI<SearchResponse>('search.messages', {
        query: `from:<@${userId}>`,
        sort: 'timestamp',
        sort_dir: 'desc',
        count: '1',
      })
      const ts = res.messages?.matches?.[0]?.ts
      const at = ts ? Number.parseFloat(ts) * 1000 : 0
      return at || null
    })
  }
}
