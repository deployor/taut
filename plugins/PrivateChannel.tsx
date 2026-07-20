// Shows the name or ID of private channels

import { TautPlugin } from '$taut'

// null means we looked it up and there is no name available
type ChannelName = string | null

export default class PrivateChannel extends TautPlugin {
  static readonly id = 'PrivateChannel'
  static readonly pluginName = 'Private Channel'
  static readonly description = 'Shows the name or ID of private channels'
  static readonly defaultConfig = `
    // Shows the name or ID of private channels
    "PrivateChannel": {
      "enabled": true
    }
  `
  static readonly authors = '<@U06UYA5GMB5>'

  private cache = new this.api.Cache<ChannelName>('private_channel_names', {
    ttl: 1 * 60 * 60 * 1000,
    maxSize: 5000,
  })

  async start() {
    this.log('Started')

    await this.cache.load()
    if (this.api.signal.aborted) return

    const SvgIcon = this.api.elements.SvgIcon

    this.api.patchComponent<{
      isNonExistent: boolean
      id: string
    }>('BaseMrkdwnChannel', (OriginalBaseMrkdwnChannel) => (props) => {
      if (props.isNonExistent) {
        const id = props.id

        const [name, setName] = React.useState<ChannelName | undefined>(() =>
          this.cache.get(id)
        )

        React.useEffect(() => {
          if (!id) return
          this.fetchChannelName(id)
            .then((fetched) => setName(fetched))
            .catch(() => {})
        }, [id])

        return (
          <span className="c-missing_channel--private">
            <SvgIcon inline={true} name="lock" />
            {name ?? id}
          </span>
        )
      }
      return <OriginalBaseMrkdwnChannel {...props} />
    })
  }

  async fetchChannelName(id: string): Promise<ChannelName> {
    return this.cache.fetch(id, async () => {
      const response = await fetch(`https://flaron.halceon.dev/cid/${id}`, {
        signal: this.api.signal,
      })
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      return typeof data.name === 'string' ? data.name : null
    })
  }
}
