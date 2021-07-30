import yargs from 'yargs/yargs'
import { promises as fs, createWriteStream } from 'fs'
import { hideBin } from 'yargs/helpers'
import { getPage, LiveChatClient, ReplayChatClient } from '../comment-client'
import path from 'path'
import { inspect } from 'util'
import { convertToLines } from '../text-convert-utils'
import { downloadImage } from '../assets-downloader'
import { createFetchInstance } from '../fetch-with-cookie'
import fetch from 'node-fetch'

yargs(hideBin(process.argv))
  .usage('Usage: $0 [options] <url>')

  .command(['$0 <url>'], 'the serve command', (yargs) => {
    return yargs
    .options({
      output: {
        type: 'string',
        alias: 'o',
        nargs: 1,
        default: '[[DATE]][[STREAM_ID]] [TITLE]',
        describe: 'Override the default output directory pattern'
      },
      'with-assets': {
        type: 'boolean',
        alias: 'a',
        nargs: 0,
        default: false,
        describe: 'Download image assets (avatar and emojis)'
      },
      'header': {
        type: 'string',
        alias: 'h',
        nargs: 1,
        array: true,
        default: <Array<string>>[],
        describe: 'Extra headers'
      },
      'cookie-jar': {
        type: 'string',
        alias: 'j',
        nargs: 1,
        default: null,
        describe: 'Cookie jar path for authorization'
      },
      'write-cookie-jar': {
        type: 'boolean',
        alias: 'w',
        nargs: 0,
        default: false,
        describe: 'Write back to Cookie jar'
      }
    })
    .positional('url', {
      type: 'string',
      describe: 'The YouTube stream/archive URL/ID',
      demandOption: true
    })
    .strict()
  }, (argv) => {
    const headerList = argv.header

    const headers: Record<string, string> = {}

    for (let item of headerList) {
      const segments = item.split(':')

      if (segments.length !== 2) {
        throw new Error(`Invalid header: ${item}`)
      }

      headers[decodeURIComponent(segments[0])] = decodeURIComponent(segments[1])
    }

    download(
      argv.url,
      argv.output,
      argv['with-assets'],
      argv['cookie-jar'],
      argv['write-cookie-jar'],
      normalizeHeaders(headers)
    )
  })
  .parseSync()

function sanitizeFilename (name: string) {
  return name.replace(/[\\\/:\*\?"<>\|]/g, '_')
}

const substitute = (str: string, dict: Record<string, string>) => {
  return str.replace(/\[([A-Z0-9_]+)\]/g, function (_, b) {
    return dict[b] ?? b
  })
}

function normalizeHeaders (header: Record<string, string>) {
  return Object.keys(header).reduce((acc, key) => {
    if(key.toLowerCase() === 'accept-language') {
      acc['Accept-Language'] = header[key]
    }
    if(key.toLowerCase() === 'user-agent') {
      acc['User-Agent'] = header[key]
    }
    acc[key] = header[key]

    return acc
  }, {} as Record<string, string>)
}

async function download(
  url: string,
  outputDir: string,
  withAssets: boolean,
  cookieJar: string | null,
  writeCookieJar: boolean,
  headers: Record<string, string>
) {
  const fetchImpl = cookieJar ? createFetchInstance(cookieJar, writeCookieJar) : fetch

  const info = await getPage(url, headers, fetchImpl)

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
    headers,
    imageDirectory: withAssets ? assetsDir : null,
    imageDownloader: downloadImage,
    fetchImpl
  }) : new ReplayChatClient({
    headers,
    imageDirectory: withAssets ? assetsDir : null,
    imageDownloader: downloadImage,
    fetchImpl
  })

  client.on('error', err => {
    console.error(inspect(err))
  })

  client.on('progress', actions => {
    for (const action of actions) {
      jsonStream.write(JSON.stringify(action) + '\n')

      try {
        const formattedLines = convertToLines(action)

        for (const line of formattedLines) {
          textStream.write(line + '\n')
        }
      } catch (err) {
        console.error('Error during format line')
        console.error(JSON.stringify(action))
        console.error(inspect(err))
      }
    }
  })

  client.on('finish', () => {
    console.log('Dump finished')
  })

  client.on('error', (err) => {
    console.error('Dump interrupted due to')
    console.error(inspect(err))
  })

  client.on('assets_error', (path, err) => {
    console.error('Error handling assets %s', path)
    console.error(inspect(err))
  })


  console.log(`Start to dump chat (${withAssets ? 'with' : 'without'} assets)`)
  console.log(`Output directory: ${solved}`)

  client.start(info)
}