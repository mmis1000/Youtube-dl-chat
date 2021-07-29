import { createReadStream } from 'fs';
import { ReadlineStream } from '../readline-stream';
import type { Actions } from '../interfaces-youtube-response';
import type { Readable } from 'stream';
import { inspect } from 'util';
import { convertToLines } from '../text-convert-utils';

const filename = process.argv[2]

let source: Readable

if (filename == null) {
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  source = process.stdin
} else {
  source = createReadStream(filename, { encoding: 'utf-8' })
}

const lineStream = source.pipe(new ReadlineStream({}))

lineStream.on('data', (l: string) => {
  let o: Actions

  try {
    o = JSON.parse(l)
  } catch (err) {
    console.error('[BAD LINE]' + l)
    return
  }

  
  try {
    const lines = convertToLines(o)

    for (const line of lines) {
      console.log(line)
    }
  } catch (err) {
    console.error('Something went wrong at line')
    console.error(l)
    console.error(inspect(err))
  }
})