import yargs from 'yargs/yargs'
import { promises as fs, createWriteStream } from 'fs'
import { hideBin } from 'yargs/helpers'
import { getPage, LiveChatClient, ReplayChatClient } from '../comment-client'
import path from 'path'
import { inspect } from 'util'
import { convertToLines } from '../text-convert-utils'
import { downloadImage } from '../assets-downloader'

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options] <url>')

  .command(['$0 <url>'], 'the serve command', (yargs) => {
    return yargs
    .options({
      output: {
        type: 'string',
        alias: 'o',
        default: '[[DATE]][[STREAM_ID]] [TITLE]',
        describe: 'Override the default output directory pattern'
      },
      'with-assets': {
        type: 'boolean',
        alias: 'a',
        nargs: 0,
        default: false,
        describe: 'Download image assets (avatar and emojis)'
      }
    })
    .positional('url', {
      type: 'string',
      describe: 'The YouTube stream/archive URL/ID',
      demandOption: true
    })
    .strict()
  }, (argv) => {
    console.log(argv)
    download(argv.url, argv.output, argv['with-assets'])
  })
  .parseSync()

console.log(argv)

function sanitizeFilename (name: string) {
  return name.replace(/[\\\/:\*\?"<>\|]/g, '_')
}

const substitute = (str: string, dict: Record<string, string>) => {
  return str.replace(/\[([A-Z0-9_]+)\]/g, function (_, b) {
    return dict[b] ?? b
  })
}

async function download(url: string, outputDir: string, withAssets: boolean) {
  const info = await getPage(url, {})

  const isLive = info.parsedInitialPlayerResponse.videoDetails.isLive === true
  const isArchive = !isLive && info.parsedInitialPlayerResponse.videoDetails.isLiveContent === true

  if (!isLive && !isArchive) {
    console.error('This is not a live url')
    return
  }

  const id = info.parsedInitialPlayerResponse.videoDetails.videoId
  const videoName = info.parsedInitialPlayerResponse.videoDetails.title
  const currentDate = new Date()
  const time =
    currentDate.getFullYear().toString()
    + (currentDate.getMonth() + 1).toString().padStart(2, '0')
    + currentDate.getDate().toString().padStart(2, '0')

  const replaced = substitute(outputDir, {
    DATE: time,
    STREAM_ID: id,
    TITLE: sanitizeFilename(videoName)
  })

  const solved = path.resolve(process.cwd(), replaced)

  await fs.mkdir(solved, { recursive: true })

  const assetsDir = path.resolve(solved, 'assets')

  if (withAssets) {
    await fs.mkdir(assetsDir, { recursive: true })
  }


  const jsonStream = createWriteStream(path.resolve(solved, 'chat.jsonl'), { flags: 'a' })
  const textStream = createWriteStream(path.resolve(solved, 'chat.txt'), { flags: 'a' })

  const client = isLive ? new LiveChatClient({
    imageDirectory: withAssets ? assetsDir : null,
    imageDownloader: downloadImage
  }) : new ReplayChatClient({
    imageDirectory: withAssets ? assetsDir : null,
    imageDownloader: downloadImage
  })

  client.on('error', err => {
    console.error(inspect(err))
  })

  client.on('progress', actions => {
    for (const action of actions) {
      jsonStream.write(JSON.stringify(action) + '\n')
      const formattedLines = convertToLines(action)

      for (const line of formattedLines) {
        textStream.write(line + '\n')
      }
    }
  })

  client.on('finish', () => {
    console.log('dump finished')
  })

  client.on('error', (err) => {
    console.error('dump interrupted due to')
    console.error(inspect(err))
  })

  console.log('starts to dump chat')

  client.start(info)
}