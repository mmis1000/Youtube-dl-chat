const url = process.argv[2]

import fetch from 'node-fetch'
import { DEFAULT_HEADERS } from '../constants'
import { parseVideo } from '../parser'

async function main () {
    const res = await fetch(
        url,
        {
            "headers": DEFAULT_HEADERS
        }
    )

    const text = await res.text()

    console.log(JSON.stringify(parseVideo(text), undefined, 2))
}

main()
