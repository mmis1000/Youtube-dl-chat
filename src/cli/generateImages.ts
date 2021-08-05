import puppeteer, { BrowserFetcherRevisionInfo, BrowserFetcher } from 'puppeteer-core';
import path from 'path'
import http from 'http';
import { promises as fs, createReadStream } from 'fs';
import { AddressInfo } from 'net';
import { Actions, ReplayAbleChatActions } from '../interfaces-youtube-response';

const ADMIN_COLOR = '#5e84fe'
const MEMBER_COLOR = '#2ba640'

const WIDTH = 320
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
    height: 480,
    deviceScaleFactor: 2
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
          })
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

  const infos: {
    id: string
    file: string
    offset: number
    height: number
    fullHeight: number
  }[] = []

  const BATCH = 100
  for (let i = 0; i < entries.length; i += BATCH) {
    const start = Date.now()
    const slice = entries.slice(i, i + BATCH)

    const viewport = await page.evaluate((actions: Line[]) => {
      return printLines(actions)
    }, mapActions(slice) as any)

    infos.push(...viewport.areas.map(it => ({
      id: it.id,
      file: `${~~(i / 100) + 1}.png`,
      offset: it.offset,
      height: it.height,
      fullHeight: ~~viewport.height
    })))
  
    await page.screenshot({
      path: `${outputDir}/${~~(i / 100) + 1}.png`,
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: WIDTH,
        height: ~~viewport.height
      },
      omitBackground: true
    })

    console.log(`Generated entries #${i} to #${Math.min(i + 99, entries.length - 1)} (${Date.now() - start}ms)`)
  }
  await fs.writeFile(`${logDir}/screenshots.json`, JSON.stringify(infos, undefined, 2))

  await browser.close();
}

main()