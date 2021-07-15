import fetch from 'node-fetch'
import EventEmitter from "events";
import { Actions, ChatData, ChatXhrData, Continuations, LiveContinuation, LiveContinuation2, ReplayChatItemAction, VideoData } from "./interfaces-youtube-response";
import { parseChat, parseVideo } from "./parser";
import { getURLVideoID } from "./youtube-dl-utils";
import { assert } from 'console';

const select = <T extends {}, U extends keyof T>(arr: T[], key: U): Pick<T, U>[U] | undefined => {
  return arr.find(it => it[key] != null)?.[key] as unknown as Pick<T, U>[U] | undefined
}

const DEFAULT_HEADERS = Object.freeze({
  "Accept-Language": "zh-TW,zh;q=0.8,en-US;q=0.5,en;q=0.3",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36"
})

export async function getPage(url: string, headers: Record<string, string>): Promise<VideoData> {
  const id = getURLVideoID(url)
  const fixedPageURL = 'https://www.youtube.com/watch?v=' + id

  const res = await fetch(
    fixedPageURL,
    {
      "headers": {
        ...DEFAULT_HEADERS,
        ...headers
      }
    }
  )

  assert(res.status >= 200 && res.status < 300, 'Must not get an error')

  const text = await res.text()

  return parseVideo(text)
}

export async function getChat(isLive: boolean, continuation: string, headers: Record<string, string>): Promise<ChatData> {
  const url = isLive
  ? 'https://www.youtube.com/live_chat?continuation=' + continuation
  : 'https://www.youtube.com/live_chat_replay?continuation=' + continuation

  const res = await fetch(
    url,
    {
      "headers": {
        ...DEFAULT_HEADERS,
        ...headers
      }
    }
  )

  assert(res.status >= 200 && res.status < 300, 'Must not get an error')

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
  isInvalidationTimeoutRequest: boolean = false
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

  const res = await fetch(
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

  assert(res.status >= 200 && res.status < 300, 'Must not get an error')

  return res.json()
}

enum ClientState {
  RUNNING,
  STOPPED
}

export class ReplayChatClient extends EventEmitter {
  state = ClientState.STOPPED
  fetchInterval = 1000

  constructor (private headers: Record<string, string> = {}) {
    super()
  }

  private getPageContinuation(data: VideoData): string {
    if (data.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar == null) {
      throw new Error('this page didn\'t seems have a chat room')
    }

    const res = select(data.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations, 'reloadContinuationData')?.continuation
  
    if (res == null) throw new Error('no token')

    return res
  }

  private getChatContinuation(data: ChatData): string {
    const res = select(data.parsedInitialData.continuationContents.liveChatContinuation.continuations, 'liveChatReplayContinuationData')?.continuation
  
    if (res == null) throw new Error('no token')

    return res
  }

  async start (pageData: VideoData) {
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
        this.headers
      )

      if (chatPageResponse.parsedInitialData.continuationContents.liveChatContinuation.actions == null) {
        return
      }

      this.emit('progress', chatPageResponse.parsedInitialData.continuationContents.liveChatContinuation.actions)

      let currentContinuation = this.getChatContinuation(chatPageResponse)

      let lastTime = 0

      while (true) {
        const data = await getChatXhr(
          false,
          chatPageResponse.parsedYtCfg.INNERTUBE_API_KEY,
          chatPageResponse.parsedYtCfg.INNERTUBE_CONTEXT,
          currentContinuation,
          this.headers,
          lastTime
        )

        const actions = data.continuationContents!.liveChatContinuation.actions

        if (!actions) {
          return
        }

        this.emit('progress', actions)

        const nextContinuation = select(data.continuationContents!.liveChatContinuation.continuations, 'liveChatReplayContinuationData')?.continuation

        if (nextContinuation == null) throw new Error('no continuation')

        currentContinuation = nextContinuation
        lastTime = Number((actions[actions.length - 1] as ReplayChatItemAction).replayChatItemAction.videoOffsetTimeMsec)

        await new Promise(r => setTimeout(r, this.fetchInterval))
      }
    } finally {
      this.state = ClientState.STOPPED
      this.emit('finish')
    }
  }

  on(ev: 'progress', cb: (list: Actions[]) => void): this
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

  constructor (private headers: Record<string, string> = {}) {
    super()
  }

  private getPageContinuation(data: VideoData): string {
    if (data.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar == null) {
      throw new Error('this page didn\'t seems have a chat room')
    }

    const res = select(data.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations, 'reloadContinuationData')?.continuation
  
    if (res == null) throw new Error('no token')

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

    throw new Error('no token')
  }

  async start (pageData: VideoData) {
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
        this.headers
      )

      this.emit('progress', chatPageResponse.parsedInitialData.continuationContents.liveChatContinuation.actions || [])

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
          this.headers,
          0,
          isInvalidationTimeoutRequest
        )

        const actions = data.continuationContents?.liveChatContinuation.actions || []

        this.emit('progress', actions)

        const nextContinuation = this.getLiveChatXhrContinuation(data)
        if (nextContinuation == null) {
          this.emit('finish')
          return
          // throw new Error('no continuation')
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
      this.emit('finish')
    }
  }

  on(ev: 'progress', cb: (list: Actions[]) => void): this
  on(ev: 'finish', cb: () => void): this
  on(ev: string, cb: (...args: any[]) => any): this {
    return super.on(ev, cb)
  }
}