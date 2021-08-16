import puppeteer, { BrowserFetcherRevisionInfo, BrowserFetcher } from 'puppeteer-core';
import path from 'path'
import { promises as fs } from 'fs';
import { generateImages, getChromiumDir } from '../screenshot-utils';

const SCALE_FACTOR = 1
const WIDTH = 320
const HEIGHT = 480
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

async function main() {
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
    console.error(`Downloading chromium ${chromiumVersion}`)
    revisionInfo = await browserFetcher.download(chromiumVersion);
    console.error(`Chromium ${chromiumVersion} downloaded to ${revisionInfo.folderPath}`)
  }

  await generateImages(
    getIndexHTML,
    getPlayerJs,
    revisionInfo,
    logFull,
    logAssetDir,
    logDir + '/screenshots.json',
    outputDir,
    WIDTH,
    HEIGHT,
    SCALE_FACTOR
  )
}

main()