// Shows the bot used to send a user message

import {
  type SlackActivityItem,
  type SlackBot,
  type SlackMessage,
  TautPlugin,
} from '$taut'

type AvatarProps = { className?: string; size?: number; userId?: string }
type ActivityAvatarProps = {
  activityItem?: SlackActivityItem
  size?: 'small' | 'large'
  children?: React.ReactNode
}
/** the avatar on a forwarded message card */
type AuthorAvatarProps = {
  memberId?: string
  icon?: string
  iconSize?: number
  isChannelEmailMessage?: boolean
}

/** the class each surface puts on the avatar it draws for a message's sender */
const SENDER_AVATARS = [
  'c-message_kit__avatar',
  'c-search_message__avatar',
  'c-message_attachment__author_icon',
]

const drawsSender = (className = '') =>
  SENDER_AVATARS.some((name) => className.split(' ').includes(name))

/** the activity view's two badge sizes, and the avatar each pairs with */
const badgeSize = (avatar = 36) => (avatar >= 32 ? 20 : 14)

export default class ShowSendingBot extends TautPlugin {
  static readonly id = 'ShowSendingBot'
  static readonly pluginName = 'Show Sending Bot'
  static readonly description = 'Shows the bot used to send a user message'
  static readonly authors = '<@U06UYA5GMB5>'
  static readonly defaultConfig = `
    // Shows the bot used to send a user message
    "ShowSendingBot": {
      "enabled": true
    }
  `

  private readonly SenderContext = React.createContext<
    SlackMessage | undefined
  >(undefined)

  private readonly Badge = ({
    bot,
    size,
    corner,
    interactive = true,
  }: {
    bot: SlackBot
    size: number
    corner?: string
    interactive?: boolean
  }) => {
    const { Avatar, ProfileHoverTrigger } = this.api.elements
    const avatar = (
      <Avatar
        botId={bot.id}
        botProfile={bot}
        size={size - 2}
        isInteractive={interactive}
      />
    )
    return (
      <span
        className={`taut-sending-bot__badge${corner ? ` taut-sending-bot__badge--${corner}` : ''}`}
        style={{ width: size, height: size }}
        data-stringify-ignore="true"
      >
        {/* the avatar draws its own card only from 36px up, so we have to add one */}
        {interactive ? (
          <ProfileHoverTrigger serviceId={bot.id} botProfile={bot}>
            {avatar}
          </ProfileHoverTrigger>
        ) : (
          avatar
        )}
      </span>
    )
  }

  private readonly Badged = ({
    msg,
    size,
    children,
  }: {
    msg: SlackMessage | undefined
    size?: number
    children: React.ReactNode
  }) => {
    const bot = this.api.messages.useUncreditedBot(msg)
    if (!bot?.id) return <>{children}</>
    return (
      <span className="taut-sending-bot">
        {children}
        <this.Badge bot={bot} size={badgeSize(size)} />
      </span>
    )
  }

  private provideMessage(
    name: string,
    messageOf: (props: any) => SlackMessage
  ) {
    this.api.patchComponent(name, (Original) => (props) => (
      <this.SenderContext.Provider value={messageOf(props)}>
        <Original {...props} />
      </this.SenderContext.Provider>
    ))
  }

  start() {
    this.api.setStyle(
      `
        .taut-sending-bot {
          position: relative;
          display: flex;
          flex-shrink: 0;
          align-self: flex-start;
        }

        .taut-sending-bot__badge {
          position: absolute;
          right: -3px;
          bottom: -3px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1px;
          border-radius: 4px;
          background-color: light-dark(
            var(--dt_color-base-sec),
            var(--dt_color-base-ter)
          );
        }

        /* activity keeps its own sender icon in the other corner */
        .taut-sending-bot__badge--bottom-left {
          left: -3px;
          right: auto;
        }

        .c-message_kit__background--hovered .taut-sending-bot__badge {
          background-color: rgba(var(--sk_foreground_min_solid, 248, 248, 248), 1);
        }
      `
    )

    this.provideMessage('MessageAvatar', (props) => props.msg)
    // search keeps its own copies of the messages, spread over the result's props
    this.provideMessage('SearchResult', (props) => props)
    this.provideMessage('MessageAttachment', (props) =>
      this.api.messages.forwardedMessage({
        channel: props.activeChannelId,
        messageTs: props.messageTs,
        index: props.attachmentIndex,
        authorId: props.authorId,
        authorLink: props.authorLink,
        authorIcon: props.authorIcon,
      })
    )

    this.api.patchComponent<AvatarProps>(
      'ConnectedBaseAvatar',
      (Original) => (props) => {
        const msg = React.useContext(this.SenderContext)
        const drawn =
          msg && drawsSender(props.className)
            ? { ...msg, user: props.userId }
            : undefined
        return (
          <this.Badged msg={drawn} size={props.size}>
            <Original {...props} />
          </this.Badged>
        )
      }
    )

    this.api.patchComponent<AuthorAvatarProps>(
      'AttachmentAuthorAvatar',
      (Original) => (props) => {
        const msg = React.useContext(this.SenderContext)
        const drawsAvatar = props.memberId && !props.isChannelEmailMessage
        return (
          <this.Badged
            msg={props.icon && !drawsAvatar ? msg : undefined}
            size={props.iconSize}
          >
            <Original {...props} />
          </this.Badged>
        )
      }
    )

    // activity uses the bottom-right corner for its own icon, so we use bottom-left
    this.api.patchComponent<ActivityAvatarProps>(
      'ActivityRowContentSenderAvatarLayout',
      (Original) => (props) => {
        const msg = this.api.messages.useActivityMessage(props.activityItem)
        const bot = this.api.messages.useUncreditedBot(msg)
        if (!bot?.id) return <Original {...props} />
        return (
          <Original {...props}>
            {props.children}
            <this.Badge
              bot={bot}
              size={badgeSize(props.size === 'large' ? 36 : 28)}
              corner="bottom-left"
              interactive={false}
            />
          </Original>
        )
      }
    )

    this.log('Started')
  }
}
