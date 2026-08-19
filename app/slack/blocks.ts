// Block Kit conversion, using Slack's own converters

import type { Delta } from '../../shared/Plugin'
import { getReduxStore } from './redux'
import { waitForExport } from './webpack'

/** One Block Kit block. Slack's composer produces `rich_text` blocks */
export type Block = Record<string, unknown>

/** Options Slack's converter accepts; all default off inside Slack */
export interface FromDeltaOptions {
  convertEmpty?: boolean
  trimEndingWhitespace?: boolean
  trimStartingWhitespace?: boolean
  expandTruncatedLinks?: boolean
  useExpandedRichText?: boolean
  splitSectionsOnNewlines?: boolean
  supportNonRichTextBlocks?: boolean
  useRichTextHeadersAndDividers?: boolean
}

type ConvertDeltaToBlocks = (arg: {
  delta: Delta
  options?: FromDeltaOptions
  state: unknown
}) => { blocks?: Block[] } | undefined

type ConvertBlocksToText = (state: unknown, blocks: Block[]) => string
type DeltaConstructor = new (ops?: unknown[]) => Delta

const named = (name: string) => (exp: any) =>
  typeof exp === 'function' && (exp.displayName || exp.name) === name

/** Quill's Delta class, identified by its prototype rather than by name */
const isDelta = (exp: any) => {
  if (typeof exp !== 'function' || !exp.prototype) return false
  const proto = exp.prototype
  return (
    typeof proto.insert === 'function' &&
    typeof proto.retain === 'function' &&
    typeof proto.concat === 'function' &&
    typeof proto.compose === 'function'
  )
}

export const blocksPromise = (async () => {
  const deltaToBlocks = waitForExport<ConvertDeltaToBlocks>(
    named('convertDeltaToBlocks')
  )
  const blocksToPlainText = waitForExport<ConvertBlocksToText>(
    named('convertBlocksToPlainText')
  )
  const blocksToMarkdown = waitForExport<ConvertBlocksToText>(
    named('convertBlocksToMarkdown')
  )
  const deltaClass = waitForExport<DeltaConstructor>(isDelta)

  function state(): unknown {
    const store = getReduxStore()
    if (!store) throw new Error('[Taut] Block Kit: redux store unavailable')
    return store.getState()
  }

  /** Build a real Delta from raw ops, e.g. the `ops` array on a stored draft */
  async function makeDelta(ops: unknown[]): Promise<Delta> {
    const Delta = await deltaClass
    return new Delta(ops)
  }

  /**
   * Convert composer content to Block Kit. Accepts a Delta or the raw ops
   * array drafts are stored as. Mentions, links and formatting are resolved
   * by Slack itself, so the result matches what its own composer would send.
   */
  async function fromDelta(
    content: Delta | unknown[],
    options?: FromDeltaOptions
  ): Promise<Block[]> {
    const convert = await deltaToBlocks
    const delta = Array.isArray(content) ? await makeDelta(content) : content
    return convert({ delta, options, state: state() })?.blocks ?? []
  }

  /** Flatten blocks to plain text, for a notification/search fallback */
  async function toPlainText(blocks: Block[]): Promise<string> {
    return (await blocksToPlainText)(state(), blocks)
  }

  /** Render blocks as Markdown, with mentions and links resolved to names */
  async function toMarkdown(blocks: Block[]): Promise<string> {
    return (await blocksToMarkdown)(state(), blocks)
  }

  return { makeDelta, fromDelta, toPlainText, toMarkdown }
})()

export type BlocksAPI = Awaited<typeof blocksPromise>
