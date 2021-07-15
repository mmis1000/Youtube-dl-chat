const url = process.argv[2]

import { getPage, LiveChatClient } from '../comment-client'

async function main () {
    const client = new LiveChatClient()

    client.on('progress', it => {
        for (let v of it) {
            console.log(JSON.stringify(v))
        }
    })

    const page = await getPage(url, {})

    client.start(page)
}

main()
