// Uploads files through Slack's own uploader

import { dispatchThunk } from './redux'

type PendingUpload = { uploadPromise?: Promise<{ fileIds?: string[] }> }

/**
 * upload as the current user, resolving with the file id. Slack reads fields
 * like `subtype` off the File and sets `id` on it, so pass a real one
 */
export async function uploadFile(file: File): Promise<string> {
  const pending: PendingUpload = await dispatchThunk(
    'addAndUploadPendingFile',
    { file, hideBanner: true }
  )
  const fileId = (await pending?.uploadPromise)?.fileIds?.[0]
  if (!fileId) throw new Error('[Taut] Slack rejected the upload')
  return fileId
}

export const filesPromise = (async () => {
  return { upload: uploadFile }
})()

export type FilesAPI = Awaited<typeof filesPromise>
