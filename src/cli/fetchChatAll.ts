const url = process.argv[2]

import { getPage, ReplayChatClient } from '../comment-client'

async function main () {
    const client = new ReplayChatClient()

    client.on('progress', it => {
        for (let v of it) {
            console.log(JSON.stringify(v))
        }
    })

    const page = await getPage(url, {})

    client.start(page)
}

main()
