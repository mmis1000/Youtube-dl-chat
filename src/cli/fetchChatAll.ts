const url = process.argv[2]

import { ReplayChatClient } from '../comment-client'

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36"

async function main () {
    const client = new ReplayChatClient()

    client.on('progress', it => {
        for (let v of it) {
            console.log(JSON.stringify(v))
        }
    })

    client.start(url)
}

main()
