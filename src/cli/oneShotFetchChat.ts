const url = process.argv[2]

import fetch from 'node-fetch'
import { parseChat, parseVideo } from '../parser'

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36"

async function main () {
    const res = await fetch(
        url,
        {
            "headers": {
                "Accept-Language": "zh-TW,zh;q=0.8,en-US;q=0.5,en;q=0.3",
                "User-Agent": userAgent
            }
        }
    )

    const text = await res.text()

    const parsedPage = parseVideo(text)
    
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
            "headers": {
                "Accept-Language": "zh-TW,zh;q=0.8,en-US;q=0.5,en;q=0.3",
                "User-Agent": userAgent
            }
        }
    )
    const chatPageText = await chatPageRes.text()
    const parsedChat = parseChat(chatPageText)

    console.log(JSON.stringify(parsedChat, undefined, 2))
}

main()
