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

export const getMessageBotId = (
  msg: SlackMessage | undefined
): string | undefined =>
  msg?.bot_id ??
  msg?.bot_profile?.id ??
  (msg?.taut_bot_id as string | undefined)

export function getRawMessage(
  channel: string,
  ts: string
): SlackMessage | undefined {
  return getRawState()?.messages?.[channel]?.[ts]
}

/** the original stored version of a rendered message, before Taut's patches */
export const asRawMessage = (
  msg: SlackMessage | undefined
): SlackMessage | undefined =>
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
  const bot = getMessageBotId(message)
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

type SenderDetails = (
  state: any,
  item: SlackActivityItem | undefined
) => { senderType?: string; senderId?: string } | undefined

export const messagesPromise = (async () => {
  const { useReduxState } = await reduxPromise
  const findExport = await findExportPromise
  // the activity view is a lazy chunk
  let cached: SenderDetails | undefined
  const readSender = (): SenderDetails | undefined =>
    (cached ??= findExport(
      (e: any) =>
        typeof e === 'function' && e.name === 'getSenderDetailsFromActivityItem'
    ))

  function useActivityMessage(
    item: SlackActivityItem | undefined
  ): SlackMessage | undefined {
    const drawn = useReduxState<string | undefined>((state) => {
      const sender = readSender()?.(state, item)
      return sender?.senderType === 'app' ? undefined : sender?.senderId
    })
    const msg =
      item?.channelId && item.messageTs
        ? getRawMessage(item.channelId, item.messageTs)
        : undefined
    return msg && { ...msg, user: drawn }
  }

  function useMessageBot(msg: SlackMessage | undefined): SlackBot | undefined {
    const botId = useReduxState(() => getMessageBotId(asRawMessage(msg)))
    const stored = useReduxState<SlackBot | undefined>((state) =>
      botId ? state.bots?.[botId] : undefined
    )
    if (!botId) return undefined
    return stored ?? asRawMessage(msg)?.bot_profile ?? { id: botId }
  }

  return {
    getRawMessage,
    asRawMessage,
    getMessageBotId,
    modifyMessageObject,
    useActivityMessage,
    useMessageBot,
  }
})()

export type MessagesAPI = Awaited<typeof messagesPromise>
