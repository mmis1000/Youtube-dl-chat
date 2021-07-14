const filename = process.argv[2]
import { promises as fs } from "fs"
import { parseChat } from "../parser"

async function main() {
    const file = await fs.readFile(filename, { encoding: 'utf-8' })

    console.log(JSON.stringify(parseChat(file) , undefined, 2))
}

main()