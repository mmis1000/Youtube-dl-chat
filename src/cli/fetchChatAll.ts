const url = process.argv[2]

import { getPage, ReplayChatClient } from '../comment-client'

async function main () {
    const client = new ReplayChatClient()

    console.error('Start to fetch chats')

    client.on('progress', it => {
        for (let v of it) {
            console.log(JSON.stringify(v))
        }
    })

    client.on('finish', () => {
        console.error('Fetch finished')
    })

    const page = await getPage(url, {})

    client.start(page)
}

main()
