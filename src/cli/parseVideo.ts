const filename = process.argv[2]
import { promises as fs } from "fs"
import { parseVideo } from "../parser"

async function main() {
    const file = await fs.readFile(filename, { encoding: 'utf-8' })

    console.log(JSON.stringify(parseVideo(file), undefined, 2))
}

main()