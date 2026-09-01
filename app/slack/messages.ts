// Reads and edits Slack message objects, and works out which bot sent one

import { getRawState, reduxPromise } from './redux'
import { findExportPromise } from './webpack'

export type SlackBotIcons = {
  image_36?: string
  image_48?: string
  image_72?: string
  emoji?: string
}

export type SlackBot = {
  id?: string
  name?: string
  app_id?: string
  user_id?: string
  deleted?: boolean
  icons?: SlackBotIcons
  [key: string]: unknown
}

export type SlackMessage = {
  channel?: string
  ts?: string
  user?: string
  bot_id?: string
  app_id?: string
  username?: string
  icons?: SlackBotIcons
  bot_profile?: SlackBot
  subtype?: string
  attachments?: SlackAttachment[]
  [key: string]: unknown
}

/** one row of the activity feed */
export type SlackActivityItem = {
  type?: string
  channelId?: string
  messageTs?: string
  [key: string]: unknown
}

/** forwarded message data */
export type SlackAttachment = {
  author_id?: string
  author_name?: string
  /** the name the forwarded message was posted under, when it overrode one */
  author_subname?: string
  author_icon?: string
  author_link?: string
  channel_id?: string
  ts?: string
  [key: string]: unknown
}

const SERVICE_RE = /\/services\/(B[A-Z0-9]+)/

const botIdOf = (msg: SlackMessage | undefined): string | undefined =>
  msg?.bot_id ??
  msg?.bot_profile?.id ??
  (msg?.taut_bot_id as string | undefined)

export function getRawMessage(
  channel: string,
  ts: string
): SlackMessage | undefined {
  return getRawState()?.messages?.[channel]?.[ts]
}

const asStored = (msg: SlackMessage | undefined): SlackMessage | undefined =>
  (typeof msg?.channel === 'string' &&
    msg.ts &&
    getRawMessage(msg.channel, msg.ts)) ||
  msg

/** return a copy of the `message` object with the given fields replaced */
export function modifyMessageObject(
  message: SlackMessage,
  edits: {
    /** credit the message to this member, dropping every trace of the bot, except taut_bot_id */
    sentBy?: string
  }
): SlackMessage {
  const next: SlackMessage = { ...message }
  if (edits.sentBy === undefined) return next

  next.user = edits.sentBy
  const bot = botIdOf(message)
  if (bot) next.taut_bot_id = bot
  // Slack tests some of these with `in`, so delete rather than blank them
  for (const key of [
    'bot_id',
    'app_id',
    'username',
    'icons',
    'bot_profile',
    'display_as_bot',
  ] as const)
    delete next[key]
  if (next.subtype === 'bot_message') delete next.subtype
  return next
}

export function forwardedMessage(forward: {
  channel?: string
  messageTs?: string
  index?: number
  authorId?: string
  authorLink?: string
  authorIcon?: string
}): SlackMessage {
  const { channel, messageTs, index = 0 } = forward
  const stored =
    channel && messageTs
      ? getRawMessage(channel, messageTs)?.attachments?.[index]
      : undefined
  const link = stored?.author_link ?? forward.authorLink
  // the (potentially custom) display name it posted under is author_subname
  const overrode = stored?.author_subname
  return {
    user: forward.authorId,
    bot_id: SERVICE_RE.exec(link ?? '')?.[1],
    icons: overrode
      ? { image_48: stored?.author_icon ?? forward.authorIcon }
      : undefined,
  }
}

type SenderDetails = (
  state: any,
  item: SlackActivityItem | undefined
) => { senderType?: string; senderId?: string } | undefined

export const messagesPromise = (async () => {
  const { useReduxState } = await reduxPromise
  const findExport = await findExportPromise
  const readSender: SenderDetails =
    findExport(
      (e: any) =>
        typeof e === 'function' &&
        e.name === 'getSenderDetailsFromActivityItem'
    ) ?? (() => undefined)

  function useActivityMessage(
    item: SlackActivityItem | undefined
  ): SlackMessage | undefined {
    const drawn = useReduxState<string | undefined>((state) => {
      const sender = readSender(state, item)
      return sender?.senderType === 'app' ? undefined : sender?.senderId
    })
    const msg =
      item?.channelId && item.messageTs
        ? getRawMessage(item.channelId, item.messageTs)
        : undefined
    return msg && { ...msg, user: drawn, icons: undefined }
  }

  /** the bot that sent a message, if hidden */
  function useUncreditedBot(
    msg: SlackMessage | undefined
  ): SlackBot | undefined {
    const botId = useReduxState(() => botIdOf(asStored(msg)))
    const stored = useReduxState<SlackBot | undefined>((state) =>
      botId ? state.bots?.[botId] : undefined
    )
    const memberBot = useReduxState<string | undefined>((state) =>
      msg?.user ? state.members?.[msg.user]?.profile?.bot_id : undefined
    )
    if (!botId) return undefined
    const bot = stored ?? asStored(msg)?.bot_profile ?? { id: botId }
    if (msg?.user)
      return memberBot === botId || bot.user_id === msg.user ? undefined : bot
    return msg?.icons ? bot : undefined
  }

  return {
    getRawMessage,
    modifyMessageObject,
    forwardedMessage,
    useActivityMessage,
    useUncreditedBot,
  }
})()

export type MessagesAPI = Awaited<typeof messagesPromise>
