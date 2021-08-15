import puppeteer, { BrowserFetcherRevisionInfo, BrowserFetcher } from 'puppeteer-core';
import path from 'path'
import http from 'http';
import { promises as fs, createReadStream } from 'fs';
import { AddressInfo } from 'net';
import { Actions, ReplayAbleChatActions } from '../interfaces-youtube-response';

const ADMIN_COLOR = '#5e84fe'
const MEMBER_COLOR = '#2ba640'

const SCALE_FACTOR = 1
const WIDTH = 320
const HEIGHT = 480
const BATCH_SIZE = 200
const PAD_ITEM = Math.ceil(HEIGHT / 16)
const chromiumVersion = '848005'
const currentDir = process.cwd();
const logDir = path.resolve(currentDir, process.argv[2]);
const logFull = path.resolve(logDir, 'chat.jsonl');
const logAssetDir = path.resolve(logDir, 'assets');
const outputDir = path.resolve(logDir, 'screenshots');

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

function createTempServer(assetsDir: string) {
  const server = http.createServer(async (req, res) => {
    const parsed = new URL(req.url!, `http://${req.headers.host}`);

    if (parsed.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write(await getIndexHTML())
      res.end()
      return
    }

    if (parsed.pathname === '/player.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.write(await getPlayerJs())
      res.end()
      return
    }

    if (parsed.pathname.startsWith('/assets/')) {
      try {
        const id = parsed.pathname.replace(/^\/assets\//, '').replace(/[\\\/]/g, '')

        try {
          await fs.stat(`${assetsDir}/${id}`)
        } catch (e) {
          if (e && e.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return
          }
        }

        const { file, mime } = JSON.parse(await fs.readFile(path.resolve(assetsDir, id), 'utf8'))

        const fileInfo = await fs.stat(path.resolve(assetsDir, file))

        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': String(fileInfo.size) });
        createReadStream(path.resolve(assetsDir, file)).pipe(res);
        return
      } catch (e) {
        console.error(e)
        res.writeHead(500)
        res.write(e.stack)
        res.end()
      }
    }
    res.end();
  });
  server.on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  return new Promise<number>((resolve, reject) => {
    server.once('error', (e) => reject(e))

    server.listen(0, '127.0.0.1', () => {
      const port = server.address()! as AddressInfo;

      resolve(port.port)

      server.unref();
    });
  })
}

export interface Screenshot {
  id: string
  file: string
  time: string
  offset: number
}

export interface ScreenshotSummary {
  info: {
    width: number
    height: number
  }

  entries: Screenshot[]
}

async function main() {
  const serverPort = await createTempServer(logAssetDir)
  console.log(`Temporary server listening at http://localhost:${serverPort}/`)

  const browserFetcher = (puppeteer as any).createBrowserFetcher() as BrowserFetcher;

  const localRevisions = await browserFetcher.localRevisions()

  let revisionInfo: BrowserFetcherRevisionInfo

  if (localRevisions.find(it => it === chromiumVersion)) {
    revisionInfo = await browserFetcher.revisionInfo(chromiumVersion)
    console.log(`Chromium ${chromiumVersion} already available at ${revisionInfo.folderPath}`)
  } else {
    console.error(`Downloading chromium ${chromiumVersion}`)
    revisionInfo = await browserFetcher.download(chromiumVersion);
    console.error(`Chromium ${chromiumVersion} downloaded to ${revisionInfo.folderPath}`)
  }

  const browser = await puppeteer.launch({
    executablePath: revisionInfo.executablePath
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: SCALE_FACTOR
  });

  await page.goto(`http://localhost:${serverPort}/`, { waitUntil: 'networkidle0' });

  const entries: Actions[] = (await fs.readFile(logFull, 'utf8')).split(/\r?\n/g).filter(Boolean).map(line => JSON.parse(line))

  await fs.mkdir(outputDir, { recursive: true })

  const mapActions = (actions: Actions[]): Line[] => {
    const lines: Line[] = []

    const mapAction = (action: ReplayAbleChatActions): Line[] => {
      if (!action.addChatItemAction) {
        return []
      }

      const item = action.addChatItemAction.item

      if (item.liveChatTextMessageRenderer) {
        const renderer = item.liveChatTextMessageRenderer
        const isMember = renderer.authorBadges?.find(it => it.liveChatAuthorBadgeRenderer?.customThumbnail != null) != null
        const isAdmin = renderer.authorBadges?.find(it => it.liveChatAuthorBadgeRenderer?.icon != null) != null
        return [{
          name: renderer.authorName?.simpleText ?? "",
          head: renderer.authorPhoto?.thumbnails[1]?.url ?? "",
          id: renderer.id,
          color: isAdmin ? ADMIN_COLOR : isMember ? MEMBER_COLOR : '#ffffff',
          badges: renderer.authorBadges?.map(it => {
            if (it.liveChatAuthorBadgeRenderer?.customThumbnail?.thumbnails[1].url) {
              return {
                type: 'url',
                url: it.liveChatAuthorBadgeRenderer?.customThumbnail?.thumbnails[1].url
              }
            } else {
              return {
                type: 'icon', icon: 'moderator'
              }
            }
          }) || [],
          message: renderer.message.runs.map(it => {
            if (it.text) {
              return {
                type: 'text' as 'text',
                text: it.text
              }
            } else {
              return {
                type: 'image',
                image: it.emoji?.image.thumbnails[1].url ?? ''
              }
            }
          }),
          time: new Date(Number(renderer.timestampUsec) / 1000).toISOString()
        }]
      } else {
        return []
      }
    }

    for (const action of actions) {
      if (action.replayChatItemAction) {
        lines.push(...action.replayChatItemAction.actions.map(mapAction).flatMap(it => it))
      } else {
        lines.push(...mapAction(action))
      }
    }

    return lines
  }


  const infos: Screenshot[] = []

  const start = Date.now()

  let imageIndex = 0

  for (let startItem = 0; startItem < entries.length; startItem += BATCH_SIZE) {
    const padItemCount = (startItem === 0) ? 0 : PAD_ITEM

    const slice = entries.slice(startItem - padItemCount, startItem + BATCH_SIZE)

    const viewport = await page.evaluate(async (actions: Line[]) => {
      const res = await printLines(actions)
      return {
        height: res.height,
        areas: res.areas.map(it => ({
          ...it,
          time: actions.find(a => a.id === it.id)!.time
        }))
      }
    }, mapActions(slice) as any)

    const partial: Screenshot[] = []

    partial.push(...viewport.areas.slice(padItemCount).map((it, i) => ({
      id: it.id,
      file: `${imageIndex + i + 1}.png`,
      time: it.time,
      offset: ~~(it.offset + it.height - HEIGHT)
    })))

    imageIndex += viewport.areas.length - padItemCount

    infos.push(...partial)

    for (let info of partial) {
      const start = Date.now()

      await page.screenshot({
        path: `${outputDir}/${info.file}`,
        type: 'png',
        clip: {
          x: 0,
          y: info.offset,
          width: WIDTH,
          height: HEIGHT
        },
        omitBackground: true,
      })

      console.log(`Generated entry ${info.file} (${Date.now() - start}ms)`)
    }

  }

  console.log(`Generated entries #0 to #${imageIndex - 1} (${Date.now() - start}ms)`)

  await fs.writeFile(`${logDir}/screenshots.json`, JSON.stringify(<ScreenshotSummary>{
    info: {
      width: WIDTH * SCALE_FACTOR,
      height: HEIGHT * SCALE_FACTOR
    },
    entries: infos
  }, undefined, 2))

  await browser.close();
}

main()