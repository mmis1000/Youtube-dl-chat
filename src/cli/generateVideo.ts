import path from 'path'
import { promises as fs } from 'fs';
import { VideoData } from '../interfaces-youtube-response';
import { ScreenshotSummary } from '../screenshot-utils';
import { generateFfmpegConfigs } from '../video-capture-utils';

const currentDir = process.cwd();
const logDir = path.resolve(currentDir, process.argv[2]);
const infoFile = path.resolve(logDir, 'info.json');
const screenshotMeta = path.resolve(logDir, 'screenshots.json');
const ffmpegInfoFile = path.resolve(logDir, 'timestamps.txt');
const shellCommandsFile = path.resolve(logDir, 'genVideo.sh');

async function main() {
  const data: VideoData = JSON.parse(await fs.readFile(infoFile, 'utf-8')) as VideoData
  const summary = JSON.parse(await fs.readFile(screenshotMeta, 'utf-8')) as ScreenshotSummary
  const configs = generateFfmpegConfigs(
    data,
    summary,
    'screenshots',
    'timestamps.txt'
  )

  await fs.writeFile(ffmpegInfoFile, configs.ffmpegInfo)
  await fs.writeFile(shellCommandsFile, configs.shellCommand)
}

main()