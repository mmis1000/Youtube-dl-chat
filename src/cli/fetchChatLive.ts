const url = process.argv[2]
import fetch  from 'node-fetch'
import { getPage, LiveChatClient } from '../comment-client'

async function main () {
    const client = new LiveChatClient()

    console.error('Start to fetch live chats')

    client.on('progress', it => {
        for (let v of it) {
            console.log(JSON.stringify(v))
        }
    })

    client.on('finish', () => {
        console.error('Stream ended')
    })

    const page = await getPage(url, {}, fetch)

    client.start(page)
}

main()
