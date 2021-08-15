import path from 'path'
import { promises as fs, createReadStream } from 'fs';
import { Actions, ReplayAbleChatActions, VideoData } from '../interfaces-youtube-response';
import { Screenshot, ScreenshotSummary } from './generateImages';

const FPS = 25
const WIDTH = 320
const HEIGHT = 480

const currentDir = process.cwd();
const logDir = path.resolve(currentDir, process.argv[2]);
const infoFile = path.resolve(logDir, 'info.json');
const screenshotDir = path.resolve(logDir, 'screenshots');
const screenshotMeta = path.resolve(logDir, 'screenshots.json');
const ffmpegInfoFile = path.resolve(logDir, 'timestamps.txt');
const shellCommandsFile = path.resolve(logDir, 'genVideo.sh');

async function main() {
  const summary = JSON.parse(await fs.readFile(screenshotMeta, 'utf-8')) as ScreenshotSummary
  const screenshots = summary.entries
  const data: VideoData = JSON.parse(await fs.readFile(infoFile, 'utf-8')) as VideoData

  const startTime = new Date(data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp)

  const endTime = data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp
    ? new Date(data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp)
    : new Date(new Date(screenshots[screenshots.length - 1].time).getTime() + 1000 * 10)
  
  const totalLength = endTime.getTime() - startTime.getTime()

  console.log(
    data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp,
    data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp,
    totalLength / 1000
  )

  interface Resolved extends Screenshot {
    relativeTime: number
    duration: number
  }

  const getRelativeFromTimestamp = (str: string) => {
    const pre = new Date(str).getTime() - startTime.getTime()
    const fixed = Math.floor(pre * FPS / 1000) * 1000 / FPS 
    return fixed
  }

  const resolvedScreenshots: Resolved[] = screenshots.map((it, i, arr) => {
    const time = getRelativeFromTimestamp(it.time)
    const duration = arr[i + 1] == null 
      ? endTime.getTime() - time
      : getRelativeFromTimestamp(arr[i + 1].time) - time
    return {
      ...it,
      relativeTime: time,
      duration
    }
  }).filter(it => it.duration > 0)

  const startIndex = Math.max(resolvedScreenshots.findIndex(i => i.relativeTime >= 0) - 1, 0)

  const prepend = resolvedScreenshots[startIndex].relativeTime > 0 
    ? [
      `file 'screenshots/empty.png'`,
      `duration ${resolvedScreenshots[startIndex].relativeTime / 1000}`
    ]
    : []

  let endIndex = resolvedScreenshots.findIndex(i => i.relativeTime > totalLength) - 1
  endIndex = endIndex === -2 ? resolvedScreenshots.length - 1 : endIndex

  const timestamps = resolvedScreenshots
    .slice(startIndex, endIndex + 1)
    .map(it => {
      const duration = it.relativeTime < 0
        ? it.duration + it.relativeTime
        : it.relativeTime + it.duration > totalLength
          ? totalLength - it.relativeTime
          : it.duration
      return [
        `file 'screenshots/${it.file}'`,
        `duration ${duration / 1000}`
      ]
    })
    .flat()

  const res = prepend.concat(timestamps)
    .join('\n')
  
  await fs.writeFile(ffmpegInfoFile, res)

  await fs.writeFile(shellCommandsFile, `ffmpeg -f lavfi -i color=c=black:s=${WIDTH}x${HEIGHT} -f concat -i timestamps.txt -filter_complex "[0:v][1:v]overlay=shortest=1[v1]" -map '[v1]' -pix_fmt yuv420p -c:v libx264 test.mp4`)
}

main()