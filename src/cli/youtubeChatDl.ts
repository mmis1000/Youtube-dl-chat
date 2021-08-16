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
import { Actions, VideoData } from '../interfaces-youtube-response'
import { generateImages, getChromiumDir, ScreenshotSummary } from '../screenshot-utils'
import puppeteer, { BrowserFetcherRevisionInfo, BrowserFetcher } from 'puppeteer-core';
import { generateFfmpegConfigs } from '../video-capture-utils'
import childProcess from 'child_process'
import readline from 'readline'

const chromiumVersion = '848005'

const getIndexHTML = async (): Promise<string> => {
  try {
    return require('../html/index.html?raw')
  } catch (err) {
    return fs.readFile(path.resolve(__dirname, '../html/index.html'), 'utf8')
  }
}
const getPlayerJs = async (): Promise<string> => {
  try {
    return require('../html/player.ts?raw')
  } catch (err) {
    return fs.readFile(path.resolve(__dirname, '../html/player.js'), 'utf8')
  }
}

yargs(hideBin(process.argv))
  .command(['$0 <url>'], 'The command for download chat', (yargs) => {
    return yargs
    .usage(`Usage: $0 [options] <url>

This is program is used to dump chat from youtube chatroom.
The full output is saved in a directory with the following structure:

  /[output]/chat.jsonl
  /[output]/chat.text
  /[output]/assets/[images] (optional)

The chat is saved in jsonl format. (One JSON object per line)
With a plain text file chat.txt for readability.

The information in chat.jsonl with assets downloaded should be enough
  to reconstruct the chat visual identically offline.`)
      .options({
        output: {
          type: 'string',
          alias: 'o',
          nargs: 1,
          default: '[[DATE]][[STREAM_ID]] [TITLE]',
          describe: 'Override the default output directory pattern'
        },
        language: {
          type: 'string',
          alias: 'l',
          nargs: 1,
          default: 'zh-TW,zh;q=0.8,en-US;q=0.5,en;q=0.3',
          describe: "Abbreviation of the Accept-Language header"
        },
        'with-assets': {
          type: 'boolean',
          alias: 'a',
          nargs: 0,
          default: false,
          describe: 'Download image assets (avatar and emojis)'
        },
        header: {
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
        },
        dry: {
          type: 'boolean',
          nargs: 0,
          default: false,
          describe: 'Dry run, show parsed arguments only'
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

    const normalized = normalizeHeaders(headers)

    const merged = {
      'Accept-Language': argv['language'],
      ...normalized
    }

    if (argv.dry) {
      console.log('Doing a dry run')
      console.log('Arguments %s', inspect(argv))
      console.log('Normalized Headers %s', inspect(merged))
      return
    }

    download(
      argv.url,
      argv.output,
      argv['with-assets'],
      argv['cookie-jar'],
      argv['write-cookie-jar'],
      merged
    )
  })
  .command(['video <dirname>'], 'The command for Generate video from recorded chat', (yargs) => {
    return yargs
      .options({
        output: {
          type: 'string',
          alias: 'o',
          nargs: 1,
          default: '[[DATE]][[STREAM_ID]] [TITLE].mp4',
          describe: 'Override the default output file name pattern'
        },
        width: {
          type: 'number',
          alias: 'w',
          nargs: 1,
          default: 320,
          describe: 'chatroom width'
        },
        height: {
          type: 'number',
          alias: 'h',
          nargs: 1,
          default: 480,
          describe: 'chatroom height'
        },
        scale: {
          type: 'number',
          alias: 's',
          nargs: 1,
          default: 1,
          describe: 'image scaling'
        },
        noVideo: {
          type: 'boolean',
          nargs: 0,
          default: false,
          describe: 'Only generate the ffmpeg playlist, don\'t invoke ffmpeg command'
        }
      })
      .positional('dirname', {
        type: 'string',
        describe: 'The recorded data',
        demandOption: true
      })
  }, (argv) => {
    generateVideo(
      argv.dirname,
      argv.output,
      argv.width,
      argv.height,
      argv.scale,
      !argv.noVideo
    )
  })
  .parseSync()

function sanitizeFilename(name: string) {
  return name.replace(/[\\\/:\*\?"<>\|]/g, '_')
}

const substitute = (str: string, dict: Record<string, string>) => {
  return str.replace(/\[([A-Z0-9_]+)\]/g, function (_, b) {
    return dict[b] ?? b
  })
}

/**
 * This only normalizes the header keys for header that conflict with build-in.
 */
function normalizeHeaders(header: Record<string, string>) {
  return Object.keys(header).reduce((acc, key) => {
    if (key.toLowerCase() === 'accept-language') {
      acc['Accept-Language'] = header[key]
    }
    if (key.toLowerCase() === 'user-agent') {
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
  const liveDate = new Date(info.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp)
  const time =
    liveDate.getFullYear().toString()
    + (liveDate.getMonth() + 1).toString().padStart(2, '0')
    + liveDate.getDate().toString().padStart(2, '0')

  const replaced = substitute(outputDir, {
    DATE: time,
    STREAM_ID: id,
    TITLE: sanitizeFilename(videoName)
  })

  const solved = path.resolve(process.cwd(), replaced)

  await fs.mkdir(solved, { recursive: true })
  await fs.writeFile(path.resolve(solved, 'info.json'), JSON.stringify(info, undefined, 2))

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

async function generateVideo(
  recordDir: string,
  outputPattern: string,
  width: number,
  height: number,
  scale: number,
  invokeFfmpeg: boolean
) {
  const info: VideoData = JSON.parse(await fs.readFile(path.resolve(recordDir, 'info.json'), 'utf-8'))

  const id = info.parsedInitialPlayerResponse.videoDetails.videoId
  const videoName = info.parsedInitialPlayerResponse.videoDetails.title
  const liveDate = new Date(info.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp)
  const time =
    liveDate.getFullYear().toString()
    + (liveDate.getMonth() + 1).toString().padStart(2, '0')
    + liveDate.getDate().toString().padStart(2, '0')

  const replaced = substitute(outputPattern, {
    DATE: time,
    STREAM_ID: id,
    TITLE: sanitizeFilename(videoName)
  })

  const solved = path.resolve(process.cwd(), replaced)

  // generate screenshots

  const chromiumDir = getChromiumDir()

  await fs.mkdir(chromiumDir, { recursive: true })

  const browserFetcher = (puppeteer as any).createBrowserFetcher({
    path: chromiumDir
  }) as BrowserFetcher;

  const localRevisions = await browserFetcher.localRevisions()

  let revisionInfo: BrowserFetcherRevisionInfo

  if (localRevisions.find(it => it === chromiumVersion)) {
    revisionInfo = await browserFetcher.revisionInfo(chromiumVersion)
    console.log(`Chromium ${chromiumVersion} already available at ${revisionInfo.folderPath}`)
  } else {
    let ans: 'unknown' | 'yes' | 'no' = 'unknown'

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  
    while (ans === 'unknown') {
      ans = await new Promise<'unknown' | 'yes' | 'no'>((resolve, reject) => {
        rl.question('Chromium is not downloaded, download now? (y/yes/n/no) ', (answer) => {
          // TODO: Log the answer in a database
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            resolve('yes')
          }
          if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
            resolve('no')
          }
          resolve('unknown')
        });
      })
    }

    rl.close()

    if (ans === 'no') {
      console.log('Not download chromium, existing now...')
      return
    }
    
    console.log(`Downloading chromium ${chromiumVersion}`)
    revisionInfo = await browserFetcher.download(chromiumVersion);
    console.log(`Chromium ${chromiumVersion} downloaded to ${revisionInfo.folderPath}`)
  }

  const entries: Actions[] = (await fs.readFile(path.resolve(recordDir, 'chat.jsonl'), 'utf8')).split(/\r?\n/g).filter(Boolean).map(line => JSON.parse(line))

  let screenshots: ScreenshotSummary

  try {
    screenshots = JSON.parse(await fs.readFile(path.resolve(recordDir, 'screenshots.json'), 'utf8'))
    console.log('Screenshot already generated, skips this part.')
  } catch {
    screenshots = await generateImages(
      getIndexHTML,
      getPlayerJs,
      revisionInfo,
      entries,
      path.resolve(recordDir, 'assets'),
      path.resolve(recordDir, 'screenshots'),
      width,
      height,
      scale
    )
  }

  await fs.writeFile(path.resolve(recordDir, 'screenshots.json'), JSON.stringify(screenshots, undefined, 2))

  const configs = generateFfmpegConfigs(
    info,
    screenshots,
    'screenshots',
    'timestamps.txt'
  )

  await fs.writeFile(path.resolve(recordDir, 'timestamps.txt'), configs.ffmpegInfo)
  await fs.writeFile(path.resolve(recordDir, 'generateVideo.sh'), '#!/bin/sh\n' + configs.shellCommand)

  console.log(`Ffmpeg playlist generated at ${path.resolve(recordDir, 'timestamps.txt')}`)

  try {
    await fs.chmod(path.resolve(recordDir, 'generateVideo.sh'), '755')
  } catch (err) {}

  if (invokeFfmpeg) {
    const { shellCommand } = generateFfmpegConfigs(
      info,
      screenshots,
      'screenshots',
      path.resolve(recordDir, 'timestamps.txt'),
      solved
    )

    childProcess.spawn('sh', ['-c', shellCommand], { stdio: 'inherit' })
  }
}