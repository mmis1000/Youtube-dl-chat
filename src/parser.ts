import { ChatData, VideoData } from "./interfaces-youtube-response"

export function parseVideo(html: string): VideoData {
    const initialData = /var ytInitialData =(.*?);<\/script/.exec(html)![1]
    const parsedInitialData = JSON.parse(initialData) as VideoData['parsedInitialData']

    const initialPlayerResponse = /var ytInitialPlayerResponse =(.*?)(?:;<\/script|;var meta = )/.exec(html)![1]
    const parsedInitialPlayerResponse = JSON.parse(initialPlayerResponse) as VideoData['parsedInitialPlayerResponse']

    return { parsedInitialData, parsedInitialPlayerResponse }
}

export function parseChat(html: string): ChatData {
    const initialData = />window\["ytInitialData"\] = (.*?);<\/script/.exec(html)![1]
    const parsedInitialData = JSON.parse(initialData) as ChatData['parsedInitialData']

    const ytCfg = />ytcfg\.set\((.*?)\);<\/script>/.exec(html)![1]
    const parsedYtCfg = JSON.parse(ytCfg) as ChatData['parsedYtCfg']

    return { parsedInitialData, parsedYtCfg }
}