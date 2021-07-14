const url = process.argv[2]

import fetch from 'node-fetch'
import { parseVideo } from '../parser'

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

    console.log(JSON.stringify(parseVideo(text), undefined, 2))
}

main()
