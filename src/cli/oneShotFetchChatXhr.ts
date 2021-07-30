const url = process.argv[2]

import fetch from 'node-fetch'
import { DEFAULT_HEADERS } from '../constants'
import { parseChat, parseVideo } from '../parser'

async function main () {
    const res = await fetch(
        url,
        {
            "headers": DEFAULT_HEADERS
        }
    )

    const text = await res.text()

    const parsedPage = parseVideo(text)
    
    if (parsedPage.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar == null) {
        throw new Error('this page didn\'t seem to have a chat room')
    }

    const continuations = parsedPage.parsedInitialData.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations

    const reloadToken = continuations.find(it => it.reloadContinuationData !== undefined)

    if (!reloadToken) {
        throw new Error('no continuation')
    }

    const isLive = parsedPage.parsedInitialPlayerResponse.videoDetails.isLive

    const chatPageUrl = isLive
        ? 'https://www.youtube.com/live_chat?continuation=' + reloadToken.reloadContinuationData.continuation
        : 'https://www.youtube.com/live_chat_replay?continuation=' + reloadToken.reloadContinuationData.continuation

    const chatPageRes = await fetch(
        chatPageUrl,
        {
            "headers": DEFAULT_HEADERS
        }
    )
    const chatPageText = await chatPageRes.text()
    const parsedChat = parseChat(chatPageText)

    const chatContinuations = parsedChat.parsedInitialData.continuationContents.liveChatContinuation.continuations
    const nextPageToken = isLive
        ? chatContinuations.map(it => it.invalidationContinuationData || it.timedContinuationData).filter(it => it != null)
        : chatContinuations.map(it => it.liveChatReplayContinuationData).filter(it => it != null)

    const xhrContinuation = nextPageToken[0]?.continuation

    if (xhrContinuation == null) {
        throw new Error('cannot get xhr token')
    }

    const innerTubeKey = parsedChat.parsedYtCfg.INNERTUBE_API_KEY
    const innerTubeContext = parsedChat.parsedYtCfg.INNERTUBE_CONTEXT

    const xhrUrl = isLive 
        ? `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${innerTubeKey}`
        : `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=${innerTubeKey}`

    const request = {
        context: {
            ...innerTubeContext
        },
        continuation: xhrContinuation,
        adSignalsInfo: {
            params: []
        },
        currentPlayerState: {
            playerOffsetMs: "0"
        }
    }

    const xhrRes = await fetch(
        xhrUrl,
        {
            headers: {
                ...DEFAULT_HEADERS,
                "content-type": "application/json"
            },
            body: JSON.stringify(request),
            method: "POST",
        }
    )

    const xhrResObj = await xhrRes.json()

    console.log(JSON.stringify(xhrResObj, undefined, 4))
}

main()
