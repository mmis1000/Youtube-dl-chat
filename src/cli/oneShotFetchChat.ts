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

    const chatPageUrl = parsedPage.parsedInitialPlayerResponse.videoDetails.isLive
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

    console.log(JSON.stringify(parsedChat, undefined, 2))
}

main()
