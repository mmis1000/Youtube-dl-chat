import type fetch from 'node-fetch'
import type { Response } from 'node-fetch'
import EventEmitter from "events";
import { Actions, AddChatItemAction, ChatData, ChatXhrData, Continuations, LiveContinuation, LiveContinuation2, ReplayAbleChatActions, ReplayChatItemAction, VideoData } from "./interfaces-youtube-response";
import { parseChat, parseVideo } from "./parser";
import { getURLVideoID, validateID } from "./youtube-dl-utils";
import assert from 'assert';
import { DEFAULT_HEADERS } from './constants';

const select = <T extends {}, U extends keyof T>(arr: T[], key: U): Pick<T, U>[U] | undefined => {
  return arr.find(it => it[key] != null)?.[key] as unknown as Pick<T, U>[U] | undefined
}

const assertResponseOk = (res: Response) => {
  assert(res.status !== 403, 'The video has been private')
  assert(res.status !== 404, 'The video has been deleted')
  assert(res.status >= 200 && res.status < 300, `Must not get an error status code ${res.status}`)
}

export async function getPage(
  urlOrId: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<VideoData> {
  const id = validateID(urlOrId) ? urlOrId : getURLVideoID(urlOrId)
  const fixedPageURL = 'https://www.youtube.com/watch?v=' + id

  const res = await fetchImpl(
    fixedPageURL,
    {
      "headers": {
        ...DEFAULT_HEADERS,
        ...headers
      }
    }
  )

  assertResponseOk(res)

  const text = await res.text()

  return parseVideo(text)
}

export async function getChat(
  isLive: boolean,
  continuation: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<ChatData> {
  const url = isLive
  ? 'https://www.youtube.com/live_chat?continuation=' + continuation
  : 'https://www.youtube.com/live_chat_replay?continuation=' + continuation

  const res = await fetchImpl(
    url,
    {
      "headers": {
        ...DEFAULT_HEADERS,
        ...headers
      }
    }
  )

  assertResponseOk(res)

  const text = await res.text()

  return parseChat(text)
}

export async function getChatXhr(
  isLive: boolean,
  innerTubeKey: string,
  innerTubeContext: Record<string, unknown>,
  continuation: string,
  headers: Record<string, string>,
  timeOffset: number = 0,
  isInvalidationTimeoutRequest: boolean = false,
  fetchImpl: typeof fetch
): Promise<ChatXhrData> {
  const url = isLive
    ? `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${innerTubeKey}`
    : `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=${innerTubeKey}`

  const requestBody = {
    context: {
        ...innerTubeContext
    },
    continuation: continuation,
    adSignalsInfo: {
        params: []
    },
    ...(isLive ? {
      isInvalidationTimeoutRequest: String(isInvalidationTimeoutRequest)
    } : {
      currentPlayerState: {
        playerOffsetMs: String(timeOffset)
      }
    })
  }

  const res = await fetchImpl(
    url,
    {
      "headers": {
        ...DEFAULT_HEADERS,
        "content-type": "application/json",
        ...headers
      },
      body: JSON.stringify(requestBody),
      method: "POST"
    }
  )

  assertResponseOk(res)

  return res.json()
}

enum ClientState {
  RUNNING,
  STOPPED
}

interface ClientOptions {
  imageDirectory?: string | null
  headers?: Record<string, string>
  imageDownloader?: (imageURL: string, imageDirectory: string) => Promise<string>
  fetchImpl?: typeof fetch
}

const extractImages = (actions: Actions[]): string[] => {
  const images: string[] = []

  const extractAddChatItemActions = (actions: AddChatItemAction[]) => {
    for (const action of actions) {
      const i = action.addChatItemAction.item

      const authorPhoto = i.liveChatMembershipItemRenderer?.authorPhoto
        ?? i.liveChatPaidMessageRenderer?.authorPhoto
        ?? i.liveChatTextMessageRenderer?.authorPhoto

      if (authorPhoto != null) {
        authorPhoto.thumbnails.forEach(it => images.push(it.url))
      }

      const text = i.liveChatPaidMessageRenderer?.message?.runs
        ?? i.liveChatTextMessageRenderer?.message?.runs
        ?? i.liveChatMembershipItemRenderer?.headerSubtext.runs
      
      if (text != null) {
        for (let seg of text) {
          if (seg.emoji) {
            seg.emoji.image.thumbnails.forEach(it => images.push(it.url))
          }
        }
      }

      const badges = i.liveChatMembershipItemRenderer?.authorBadges
        ?? i.liveChatTextMessageRenderer?.authorBadges
        ?? i.liveChatPaidMessageRenderer?.authorBadges

      if(badges != null) {
        for (let badge of badges) {
          badge.liveChatAuthorBadgeRenderer?.customThumbnail?.thumbnails.forEach(it => images.push(it.url))
        }
      }
    }
  }

  for (const action of actions) {
    if (action.replayChatItemAction) {
      extractAddChatItemActions(
        action.replayChatItemAction.actions
        .filter(
          (it => it.addChatItemAction != null) as (it: ReplayAbleChatActions) => it is AddChatItemAction)
        )
    } else if (action.addChatItemAction) {
      extractAddChatItemActions([action])
    }
  }

  return images
}


export const dummyDownloadImage = async (imageURL: string, imageDirectory: string): Promise<string> => {
  return ''
}

export class ReplayChatClient extends EventEmitter {
  state = ClientState.STOPPED
  fetchInterval = 1000

  downloadImage: (imageURL: string, imageDirectory: string) => Promise<string>
  downloadedImages = new Map<string, Promise<string>>()

  fetchImpl: typeof fetch

  constructor (private options: ClientOptions = {}) {
    super()
    this.downloadImage = options.imageDownloader ?? dummyDownloadImage
    if (!options.fetchImpl) {
      throw new Error('must provide a fetch implementation')
    }
    this.fetchImpl = options.fetchImpl
  }

  async processActions (actions: Actions[]) {
    const pendingDownloads: Promise<string>[] = []

    if (this.options.imageDirectory != null) {
      try {
        const images = extractImages(actions)

        for (let image of images) {
          if (!this.downloadedImages.has(image)) {
            const p = this.downloadImage(image, this.options.imageDirectory)
              .then(path => {
                this.emit('assets_progress', image, path)
                return path
              })
              .catch((err: Error) => {
                this.emit('assets_error', image, err)
                throw err
              })
            pendingDownloads.push(p)
            this.downloadedImages.set(image, p)
          }
        }
      } catch (err) {
        this.emit('assets_error', '', err)
      }
    }

    this.emit('progress', actions)
    return Promise.allSettled(pendingDownloads)
  }

  private getPageContinuation(data: VideoData): string {
    if (data.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar == null) {
      throw new Error('this page didn\'t seem to have a chat room')
    }

    const res = select(data.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations, 'reloadContinuationData')?.continuation
  
    if (res == null) throw new Error("Page don't have a continuation token")

    return res
  }

  private getChatContinuation(data: ChatData): string {
    const res = select(data.parsedInitialData.continuationContents.liveChatContinuation.continuations, 'liveChatReplayContinuationData')?.continuation
  
    if (res == null) throw new Error("Page don't have a continuation token")

    return res
  }

  async start (pageData: VideoData) {
    try {
      await this.start_(pageData)
      this.emit('finish')
    } catch (err) {
      this.emit('error', err)
    }
  }

  private async start_ (pageData: VideoData) {
    if (this.state !== ClientState.STOPPED) {
      throw new Error('client is already running')
    }

    try {
      if (pageData.parsedInitialPlayerResponse.videoDetails.isLive) {
        throw new Error('it is a live')
      }


      const chatPageResponse = await getChat(
        false,
        this.getPageContinuation(pageData),
        this.options.headers ?? {},
        this.fetchImpl
      )

      if (chatPageResponse.parsedInitialData.continuationContents.liveChatContinuation.actions == null) {
        return
      }

      this.processActions(chatPageResponse.parsedInitialData.continuationContents.liveChatContinuation.actions)

      let currentContinuation = this.getChatContinuation(chatPageResponse)

      let lastTime = 0

      while (true) {
        const data = await getChatXhr(
          false,
          chatPageResponse.parsedYtCfg.INNERTUBE_API_KEY,
          chatPageResponse.parsedYtCfg.INNERTUBE_CONTEXT,
          currentContinuation,
          this.options.headers ?? {},
          lastTime,
          false,
          this.fetchImpl
        )

        const actions = data.continuationContents!.liveChatContinuation.actions

        if (!actions) {
          return
        }

        await this.processActions(actions)

        const nextContinuation = select(data.continuationContents!.liveChatContinuation.continuations, 'liveChatReplayContinuationData')?.continuation

        if (nextContinuation == null) throw new Error("Response don't have a continuation token")

        currentContinuation = nextContinuation
        lastTime = Number((actions[actions.length - 1] as ReplayChatItemAction).replayChatItemAction.videoOffsetTimeMsec)

        await new Promise(r => setTimeout(r, this.fetchInterval))
      }
    } finally {
      this.state = ClientState.STOPPED
    }
  }

  on(ev: 'error', cb: (err: Error) => void): this
  on(ev: 'progress', cb: (list: Actions[]) => void): this
  on(ev: 'assets_error', cb: (url: string, err: Error) => void): this
  on(ev: 'assets_progress', cb: (url: string, file_path: string) => void): this
  on(ev: 'finish', cb: () => void): this
  on(ev: string, cb: (...args: any[]) => any): this {
    return super.on(ev, cb)
  }
}

export class LiveChatClient extends EventEmitter {
  state = ClientState.STOPPED
  lastPullResult = true // The first is always a burst regardless of whether is has content

  private readonly maxBursts = 2
  // The first always burst
  private remainingBursts = 1
  private readonly burstFetchInterval = 1000

  downloadImage: (imageURL: string, imageDirectory: string) => Promise<string>
  downloadedImages = new Map<string, Promise<string>>()

  fetchImpl: typeof fetch

  constructor (private options: ClientOptions = {}) {
    super()
    this.downloadImage = options.imageDownloader ?? dummyDownloadImage
    if (!options.fetchImpl) {
      throw new Error('must provide a fetch implementation')
    }
    this.fetchImpl = options.fetchImpl
  }

  async processActions (actions: Actions[]) {
    const pendingDownloads: Promise<string>[] = []

    if (this.options.imageDirectory != null) {
      const images = extractImages(actions)

      for (let image of images) {
        if (!this.downloadedImages.has(image)) {
          const p = this.downloadImage(image, this.options.imageDirectory)
            .then(path => {
              this.emit('assets_progress', image, path)
              return path
            })
            .catch((err: Error) => {
              this.emit('assets_error', image, err)
              throw err
            })
          pendingDownloads.push(p)
          this.downloadedImages.set(image, p)
        }
      }
    }

    this.emit('progress', actions)
    return Promise.allSettled(pendingDownloads)
  }

  private getPageContinuation(data: VideoData): string {
    if (data.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar == null) {
      throw new Error('this page didn\'t seem to have a chat room')
    }

    const res = select(data.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations, 'reloadContinuationData')?.continuation
  
    if (res == null) throw new Error("Page don't have a continuation token")

    return res
  }

  private getLiveChatContinuation(data: ChatData): LiveContinuation | LiveContinuation2 {
    return this._getLiveChatContinuation(data.parsedInitialData.continuationContents.liveChatContinuation.continuations)
  }

  private getLiveChatXhrContinuation(data: ChatXhrData): LiveContinuation | LiveContinuation2  | null {
    if (!data.continuationContents) {
      return null
    }
  
    return this._getLiveChatContinuation(data.continuationContents.liveChatContinuation.continuations)
  }

  private _getLiveChatContinuation(c: Continuations[]):  LiveContinuation | LiveContinuation2 {
    const res = select(c, 'invalidationContinuationData')
    const res2 = select(c, 'timedContinuationData')

    if (res) {
      return { 'invalidationContinuationData': res}
    }

    if (res2) {
      return { 'timedContinuationData': res2 }
    }

    throw new Error("Page don't have a continuation token")
  }

  async start (pageData: VideoData) {
    try {
      await this.start_(pageData)
      this.emit('finish')
    } catch (err) {
      this.emit('error', err)
    }
  }

  private async start_ (pageData: VideoData) {
    if (this.state !== ClientState.STOPPED) {
      throw new Error('client is already running')
    }

    try {
      if (!pageData.parsedInitialPlayerResponse.videoDetails.isLive) {
        throw new Error('it is not a live')
      }


      const chatPageResponse = await getChat(
        true,
        this.getPageContinuation(pageData),
        this.options.headers ?? {},
        this.fetchImpl
      )

      this.processActions(chatPageResponse.parsedInitialData.continuationContents.liveChatContinuation.actions || [])

      let currentContinuation = this.getLiveChatContinuation(chatPageResponse)
      
      const getTokenAndDelay = (c: LiveContinuation | LiveContinuation2): [isInvalidation: boolean, delay: number, token: string] => {
        if (c.invalidationContinuationData) {
          return [true, Number(c.invalidationContinuationData.timeoutMs), c.invalidationContinuationData.continuation]
        } else {
          return [true, Number(c.timedContinuationData.timeoutMs), c.timedContinuationData.continuation]
        }
      }

      let currentContinuationToken = getTokenAndDelay(currentContinuation)[2]
      let isInvalidationTimeoutRequest = false
      while (true) {
        const data = await getChatXhr(
          true,
          chatPageResponse.parsedYtCfg.INNERTUBE_API_KEY,
          chatPageResponse.parsedYtCfg.INNERTUBE_CONTEXT,
          currentContinuationToken,
          this.options.headers ?? {},
          0,
          isInvalidationTimeoutRequest,
          this.fetchImpl
        )

        const actions = data.continuationContents?.liveChatContinuation.actions || []

        this.processActions(actions)

        const nextContinuation = this.getLiveChatXhrContinuation(data)
        if (nextContinuation == null) {
          return
        }

        const [allowBurst, timeout, token] = getTokenAndDelay(nextContinuation)

        if (allowBurst) {
          if (actions.length > 0) {
            this.remainingBursts = this.maxBursts
          }
        }

        isInvalidationTimeoutRequest = allowBurst && this.remainingBursts > 0
        currentContinuationToken = token

        if (allowBurst && this.remainingBursts > 0) {
          this.remainingBursts--
          await new Promise(r => setTimeout(r, this.burstFetchInterval))
        } else {
          await new Promise(r => setTimeout(r, timeout))
        }
      }
    } finally {
      this.state = ClientState.STOPPED
    }
  }

  on(ev: 'error', cb: (err: Error) => void): this
  on(ev: 'progress', cb: (list: Actions[]) => void): this
  on(ev: 'assets_error', cb: (url: string, err: Error) => void): this
  on(ev: 'assets_progress', cb: (url: string, file_path: string) => void): this
  on(ev: 'finish', cb: () => void): this
  on(ev: string, cb: (...args: any[]) => any): this {
    return super.on(ev, cb)
  }
}