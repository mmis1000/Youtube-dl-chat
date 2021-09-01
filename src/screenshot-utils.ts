import path from 'path'
import http from 'http';
import { promises as fs, createReadStream } from 'fs';
import { AddressInfo } from 'net';
import puppeteer, { BrowserFetcherRevisionInfo, BrowserFetcher } from 'puppeteer-core';
import { Actions, ReplayAbleChatActions } from './interfaces-youtube-response';
import os from 'os'
import { APP_NAME } from './constants';

export const CHROME_DIR = 'local-chromium'

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
    scale: number
    emptyFile: string
  }

  entries: Screenshot[]
}

export const getChromiumDir = () => {
  let chromiumDir: string

  const platform = os.platform()

  if (platform === 'darwin') {
    chromiumDir = process.env.HOME + `/Library/Application Support/${APP_NAME}/local-chromium`
  } else if (platform === 'win32') {
    chromiumDir = ( process.env.LOCALAPPDATA ?? process.env.APPDATA) + `\\${APP_NAME}\\local-chromium`
  } else {
    if (process.env.XDG_DATA_HOME) {
      chromiumDir = process.env.XDG_DATA_HOME + `/${APP_NAME}/local-chromium`
    } else {
      chromiumDir = process.env.HOME + `/.local/share/${APP_NAME}/local-chromium`
    }
  }

  return chromiumDir
}

function createTempServer(getIndexHTML: () => Promise<string>, getPlayerJs: () => Promise<string>, assetsDir: string) {
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

const ADMIN_COLOR = '#5e84fe'
const MEMBER_COLOR = '#2ba640'
const BATCH_SIZE = 200

export async function generateImages(
  getIndexHTML: () => Promise<string>,
  getPlayerJs: () => Promise<string>,
  revisionInfo: BrowserFetcherRevisionInfo,
  entries: Actions[],
  logAssetDir: string,
  screenshotDir: string,
  WIDTH: number = 320,
  HEIGHT: number = 480,
  SCALE_FACTOR: number = 1
) {
  const PAD_ITEM = Math.ceil(HEIGHT / 16)

  const serverPort = await createTempServer(getIndexHTML, getPlayerJs, logAssetDir)

  console.log(`Temporary server listening at http://localhost:${serverPort}/`)

  const browser = await puppeteer.launch({
    executablePath: revisionInfo.executablePath
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: SCALE_FACTOR
    });

    await page.goto(`http://localhost:${serverPort}/`, { waitUntil: 'networkidle0' });

    // const entries: Actions[] = (await fs.readFile(logPath, 'utf8')).split(/\r?\n/g).filter(Boolean).map(line => JSON.parse(line))

    await fs.mkdir(screenshotDir, { recursive: true })

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
                  image: it.emoji?.image.thumbnails[1]?.url 
                    ?? it.emoji?.image.thumbnails[0]?.url
                    ?? ''
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

    // Generate empty file

    const emptyFile = 'empty.png'

    await page.screenshot({
      path: `${screenshotDir}/${emptyFile}`,
      type: 'png',
      clip: {
        x: 0,
        y: -HEIGHT,
        width: WIDTH,
        height: HEIGHT
      },
      omitBackground: true,
    })

    console.log(`Generated empty file`)

    // Generate actual screenshot

    const infos: Screenshot[] = []

    const start = Date.now()

    let imageIndex = 0

    for (let startItem = 0; startItem < entries.length; startItem += BATCH_SIZE) {
      const padItemCount = (startItem === 0) ? 0 : PAD_ITEM

      const padItems = mapActions(entries.slice(startItem - padItemCount, startItem))
      const items = mapActions(entries.slice(startItem, startItem + BATCH_SIZE))

      const viewport = await page.evaluate(async (actions: Line[]) => {
        const res = await printLines(actions)
        return {
          height: res.height,
          areas: res.areas.map(it => ({
            ...it,
            time: actions.find(a => a.id === it.id)!.time
          }))
        }
      }, [...padItems, ...items] as any)

      const partial: Screenshot[] = []

      partial.push(
        ...viewport.areas
        .filter(it => {
          return padItems.findIndex(p => p.id === it.id) < 0
        })
        .map((it, i) => ({
          id: it.id,
          file: `${imageIndex + i + 1}.png`,
          time: it.time,
          offset: ~~(it.offset + it.height - HEIGHT)
        }))
      )

      imageIndex += viewport.areas.length - padItemCount

      infos.push(...partial)

      for (let info of partial) {
        const start = Date.now()

        await page.screenshot({
          path: `${screenshotDir}/${info.file}`,
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

    return <ScreenshotSummary>{
      info: {
        width: WIDTH,
        height: HEIGHT,
        scale: SCALE_FACTOR,
        emptyFile: emptyFile
      },
      entries: infos
    }
  } finally {
    await browser.close();
  }
}