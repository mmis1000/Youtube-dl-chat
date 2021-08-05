import puppeteer from 'puppeteer-core';
import path from 'path'
import { promises as fs } from 'fs';

const currentDir = process.cwd();
const htmlPath = path.resolve(currentDir, process.argv[2]);

const WIDTH = 360

async function main() {
  const browserFetcher = (puppeteer as any).createBrowserFetcher();
  console.error('Downloading chromium 848005')
  const revisionInfo = await browserFetcher.download(848005);
  console.error('Chromium 848005 downloaded')
  const browser = await puppeteer.launch({
    executablePath: revisionInfo.executablePath
  });

  const page = await browser.newPage();

  await page.setViewport({ width: WIDTH, height: 480 });

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  const viewport = await page.evaluate(() => {
    const rec = printLines([
      {
        id: 'a',
        name: 'АндрейАндрейАндрейАндрейАндрейАндрейндрей',
        color: '#ff0000',
        head: './images/head.jpg',
        badges: [{
          type: 'icon',
          icon: 'moderator'
        }],
        message: [
          {
            type: 'text',
            text: 'ПриветПриветПриветПриветПриветПриветПриветПриветПриветПривет'
          }
        ]
      },
      {
        id: 'b',
        name: 'Андрей',
        color: '#ff0000',
        head: './images/head.jpg',
        badges: [],
        message: [
          {
            type: 'text',
            text: 'Привет'
          },
          {
            type: 'text',
            text: 'Привет'
          },
          {
            type: 'text',
            text: 'Привет'
          },
          {
            type: 'text',
            text: 'Привет'
          },
          {
            type: 'text',
            text: 'Привет'
          },
          {
            type: 'text',
            text: 'Привет'
          },
          {
            type: 'text',
            text: 'Привет'
          }
        ]
      },
      {
        id: 'c',
        name: 'Андрей',
        color: '#ff0000',
        head: './images/head.jpg',
        badges: [],
        message: [
          {
            type: 'text',
            text: 'Привет'
          },
          {
            type: 'text',
            text: 'エンジョイ烏​普通に仲間になったな'
          },
        ]
      },
      {
        id: 'd',
        name: 'Андрей',
        color: '#ff0000',
        head: './images/head.jpg',
        badges: [],
        message: [
          {
            type: 'text',
            text: 'Привет'
          },
          {
            type: 'text',
            text: 'エンジョイ烏​普通に仲間になったな'
          },
        ]
      },
      {
        id: 'e',
        name: 'Андрей',
        color: '#ff0000',
        head: './images/head.jpg',
        badges: [],
        message: [
          {
            type: 'text',
            text: 'Привет'
          },
        ]
      },
      {
        id: 'f',
        name: 'Андрей',
        color: '#ff0000',
        head: './images/head.jpg',
        badges: [],
        message: [
          {
            type: 'image',
            image: './emojis/emoji_u1f427.svg'
          },
          {
            type: 'image',
            image: './emojis/emoji_u1f427.svg'
          },
          {
            type: 'image',
            image: './emojis/emoji_u1f427.svg'
          },
          {
            type: 'image',
            image: './emojis/emoji_u1f427.svg'
          },
          {
            type: 'image',
            image: './emojis/emoji_u1f427.svg'
          },
          {
            type: 'image',
            image: './emojis/emoji_u1f427.svg'
          },
        ]
      }
    ]);

    return rec
  })

  console.log(viewport)

  await fs.mkdir('./screenshots', { recursive: true })


  for (const [index, area] of viewport.areas.entries()) {
    await page.screenshot({
      path: `./screenshots/${area.id}.png`,
      type: 'png',
      clip: {
        x: 0,
        y: area.offset,
        width: WIDTH,
        height: area.height
      }
    })
    await fs.writeFile(`./screenshots/${area.id}.json`, JSON.stringify(area))
  }

  await browser.close();
}

main()