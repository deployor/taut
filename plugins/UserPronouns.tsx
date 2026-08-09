// Shows each person's pronouns after the timestamp on their messages

import { TautPlugin } from '$taut'

type BroadcastPreambleProps = {
  msg?: { user?: string; bot_id?: string }
  children?: React.ReactNode
}

const USER_ID_RE = /^[UW][A-Z0-9]+$/
const MAX_LENGTH = 40

// grouped messages get the same children back with visible: false
const isHeaderChild = (child: React.ReactNode, prop: string): boolean => {
  const props = React.isValidElement(child) ? child.props : null
  if (typeof props !== 'object' || props === null) return false
  return prop in props && (props as { visible?: boolean }).visible !== false
}

const isTimestamp = (child: React.ReactNode) =>
  isHeaderChild(child, 'clickable')

// compact mode moves the timestamp to the left gutter, so sit after the sender
const isSender = (child: React.ReactNode) =>
  isHeaderChild(child, 'isInteractive')

export default class UserPronouns extends TautPlugin {
  static readonly id = 'UserPronouns'
  static readonly pluginName = 'User Pronouns'
  static readonly description =
    "Shows people's pronouns next to the timestamp on their messages"
  static readonly authors = '<@U06UYA5GMB5>'
  static readonly defaultConfig = `
    // Shows people's pronouns next to the timestamp on their messages
    "UserPronouns": {
      "enabled": true
    }
  `

  private readonly Pronouns = ({
    userId,
    bulleted,
  }: {
    userId: string
    bulleted: boolean
  }) => {
    const member = this.api.members.useMember(userId)
    const pronouns = String(member?.profile?.pronouns ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!pronouns) return null
    return (
      <span
        className={`taut-pronouns${bulleted ? ' taut-pronouns--bulleted' : ''}`}
        data-stringify-ignore=""
      >
        {pronouns.slice(0, MAX_LENGTH)}
      </span>
    )
  }

  start() {
    this.api.setStyle(
      `
        .taut-pronouns {
          margin-left: 6px;
          font-size: 12px;
          font-weight: 400;
          color: rgba(var(--sk_foreground_max_solid, 97, 96, 97), 1);
          white-space: nowrap;
          cursor: default;
          user-select: none;
        }

        .taut-pronouns--bulleted {
          margin-left: 0;
        }

        .taut-pronouns--bulleted::before {
          content: '\\2022';
          margin: 0 4px;
        }
      `
    )

    // the one component handed both the sender and the timestamp
    this.api.patchComponent<BroadcastPreambleProps>(
      'BroadcastPreamble',
      (Original) => (props) => {
        const userId = props.msg?.user
        if (
          !userId ||
          !USER_ID_RE.test(userId) ||
          userId === 'USLACKBOT' ||
          props.msg?.bot_id
        ) {
          return <Original {...props} />
        }

        const children = React.Children.toArray(props.children)
        const timestamp = children.findIndex(isTimestamp)
        const anchor =
          timestamp === -1 ? children.findIndex(isSender) : timestamp
        if (anchor === -1) return <Original {...props} />

        // the bullet only earns its place as a separator from the timestamp
        children.splice(
          anchor + 1,
          0,
          <this.Pronouns
            key="taut-pronouns"
            userId={userId}
            bulleted={timestamp !== -1}
          />
        )
        return <Original {...props}>{children}</Original>
      }
    )

    this.log('Started')
  }
}
