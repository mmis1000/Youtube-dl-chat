import fetch from 'node-fetch'
import EventEmitter from "events";
import { Actions, ChatData, ChatXhrData, ReplayChatItemAction, VideoData } from "./interfaces-youtube-response";
import { parseChat, parseVideo } from "./parser";
import { getURLVideoID } from "./youtube-dl-utils";

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

  const text = await res.text()

  return parseChat(text)
}

export async function getChatXhr(
  isLive: boolean,
  innerTubeKey: string,
  innerTubeContext: Record<string, unknown>,
  continuation: string,
  headers: Record<string, string>,
  timeOffset: number = 0
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
    currentPlayerState: {
        playerOffsetMs: String(timeOffset)
    }
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
    const res = select(data.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations, 'reloadContinuationData')?.continuation
  
    if (res == null) throw new Error('no token')

    return res
  }

  private getChatContinuation(data: ChatData): string {
    const res = select(data.parsedInitialData.continuationContents.liveChatContinuation.continuations, 'liveChatReplayContinuationData')?.continuation
  
    if (res == null) throw new Error('no token')

    return res
  }
  async start (url: string) {
    if (this.state !== ClientState.STOPPED) {
      throw new Error('client is already running')
    }

    this.state = ClientState.RUNNING

    try {
      const pageData = await getPage(url, this.headers)

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

        const actions = data.continuationContents.liveChatContinuation.actions

        if (!actions) {
          return
        }

        this.emit('progress', actions)

        const nextContinuation = select(data.continuationContents.liveChatContinuation.continuations, 'liveChatReplayContinuationData')?.continuation

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