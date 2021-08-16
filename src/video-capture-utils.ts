import { VideoData } from "./interfaces-youtube-response"
import { Screenshot, ScreenshotSummary } from "./screenshot-utils"

const FPS = 25

const escapeArg = (str: string) => {
  return "'" +  str.replace(/'/g, `'"'"'`) + "'"
}

export function generateFfmpegConfigs (
  data: VideoData,
  summary: ScreenshotSummary,
  screenshotDir: string = 'screenshots',
  concatScriptName: string = 'timestamps.txt',
  outputFileName: string = 'test.mp4'
) {
  const WIDTH = summary.info.width
  const HEIGHT = summary.info.height
  const SCALE = summary.info.scale

  const screenshots = summary.entries
  const startTime = new Date(data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp)

  const endTime = data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp
    ? new Date(data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp)
    : new Date(new Date(screenshots[screenshots.length - 1].time).getTime() + 1000 * 10)
  
  const totalLength = endTime.getTime() - startTime.getTime()

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
      ? time > totalLength
        ? 10000
        : endTime.getTime() - new Date(it.time).getTime()
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
      `file '${screenshotDir}/empty.png'`,
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
        `file '${screenshotDir}/${it.file}'`,
        `duration ${duration / 1000}`
      ]
    })
    .flat()

  const res = prepend.concat(timestamps)
    .join('\n')

  return {
    ffmpegInfo: res,
    shellCommand: `ffmpeg -v quiet -stats -f lavfi -i color=c=black:s=${WIDTH * SCALE}x${HEIGHT * SCALE} -f concat -i ${escapeArg(concatScriptName)} -filter_complex "[1:v]fps=fps=${FPS}[v0];[0:v][v0]overlay=shortest=1[v1]" -map '[v1]' -pix_fmt yuv420p -c:v libx264 ${escapeArg(outputFileName)}`
  }
}