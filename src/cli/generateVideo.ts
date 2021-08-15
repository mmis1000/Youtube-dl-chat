import path from 'path'
import { promises as fs, createReadStream } from 'fs';
import { Actions, ReplayAbleChatActions, VideoData } from '../interfaces-youtube-response';
import { Screenshot, ScreenshotSummary } from './generateImages';

const WIDTH = 320
const HEIGHT = 480

const currentDir = process.cwd();
const logDir = path.resolve(currentDir, process.argv[2]);
const infoFile = path.resolve(logDir, 'info.json');
const screenshotDir = path.resolve(logDir, 'screenshots');
const screenshotMeta = path.resolve(logDir, 'screenshots.json');
const ffmpegCommandsFile = path.resolve(logDir, 'ffmpeg-cmd.txt');
const shellCommandsFile = path.resolve(logDir, 'genVideo.sh');

async function main() {
  const summary = JSON.parse(await fs.readFile(screenshotMeta, 'utf-8')) as ScreenshotSummary
  const screenshots = summary.entries
  const images = summary.files
  const data: VideoData = JSON.parse(await fs.readFile(infoFile, 'utf-8')) as VideoData

  const startTime = new Date(data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp)

  const endTime = data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp
    ? new Date(data.parsedInitialPlayerResponse.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp)
    : new Date(new Date(screenshots[screenshots.length - 1].time).getTime() + 1000 * 10)
  
  const totalLength = endTime.getTime() - startTime.getTime()

  interface Resolved extends Screenshot {
    relativeTime: number
  }

  const resolvedScreenshots: Resolved[] = screenshots.map(it => ({
    ...it,
    relativeTime: new Date(it.time).getTime() - startTime.getTime()
  }))

  const resolvedImages = images.map((it, index) => {
    const start = screenshots.findIndex(s => s.id === it.startItem)
    const initialEnd = screenshots.findIndex(s => s.id === it.endItem)
    let newEnd: number = initialEnd
    
    let current = initialEnd + 1

    while (screenshots[current] != null) {
      if (screenshots[current].offset + screenshots[current].height > HEIGHT) {
        newEnd = current - 1
        break
      }
      current++
    }

    const entryStartTime = new Date(screenshots[start].time).getTime() - startTime.getTime()
    const entryEndTime = screenshots[newEnd + 1]
      ? new Date(screenshots[newEnd + 1].time).getTime() - startTime.getTime()
      : endTime.getTime() - startTime.getTime()

    return {
      ...it,
      startIndex: start,
      startTime: entryStartTime,
      endIndex: newEnd,
      endTime: entryEndTime,
      index
    }
  })

  type resolvedFile = (typeof resolvedImages)[number]

  interface ScriptLine {
    time: string,
    items: string[][]
  }
  const scriptLines: ScriptLine[] = []

  let previousFile: resolvedFile | undefined
  let currentFile: resolvedFile | undefined

  const firstIndex = Math.max(
    resolvedScreenshots.findIndex(i => i.relativeTime >= 0) - 1,
    0
  )
  const lastIndex = Math.max(
    resolvedScreenshots.findIndex(i => i.relativeTime >= totalLength),
    screenshots.length - 1
  )

  for (let i = 0; i < screenshots.length; i++) {
    const item = resolvedScreenshots[i]

    const enteredItem = resolvedImages.find(it => it.startIndex === i)
    const leavedItem = resolvedImages.find(it => it.endIndex === i)

    // write entry

    const entry: ScriptLine = {
      time: (Math.max(item.relativeTime, 0) / 1000).toFixed(2),
      items: []
    }

    if (i >= firstIndex && i <= lastIndex) {
      scriptLines.push(entry)
    }

    if (enteredItem != null) {
      previousFile = currentFile
      currentFile = enteredItem
    }

    const correctedOffset = item.offset + item.height

    if (previousFile) {
      // it will be cropped
      const croppedHeight = HEIGHT - correctedOffset

      entry.items.push(
        [
          `crop@${previousFile.index}`,
          'y',
          `${previousFile.height - (HEIGHT - correctedOffset)}`
        ],
        [
          `crop@${previousFile.index}`,
          'h',
          `${croppedHeight}`
        ],
        [
          `overlay@${previousFile.index}`,
          'y',
          '0'
        ]
      )
    }

    if (leavedItem != null) {
      previousFile = undefined
    }

    if (currentFile) {
      if (correctedOffset < HEIGHT) {
        // it will be cropped
        entry.items.push(
          [
            `crop@${currentFile.index}`,
            'y',
            '0'
          ],
          [
            `crop@${currentFile.index}`,
            'h',
            `${correctedOffset}`
          ],
          [
            `overlay@${currentFile.index}`,
            'y',
            `${HEIGHT - correctedOffset}`
          ]
        )
      } else {
        entry.items.push(
          [
            `crop@${currentFile.index}`,
            'y',
            `${correctedOffset - HEIGHT}`
          ],
          [
            `crop@${currentFile.index}`,
            'h',
            `${HEIGHT}`
          ],
          [
            `overlay@${currentFile.index}`,
            'y',
            `0`
          ]
        )
      }
    }
  }

  const filters: string[] = []

  filters.push('[0:v]sendcmd=f=ffmpeg-cmd.txt,nullsink')

  for (let i = 0; i < resolvedImages.length; i++) {
    let input: string
    if (i === 0) {
      input = '0:v'
    } else {
      input = `v${i - 1}`
    }

    
    filters.push(
      `[${i + 1}:v]crop@${i}=h=2[c${i}]`,
      `[${input}][c${i}]overlay@${i}=enable='between(t,${(Math.max(resolvedImages[i].startTime, 0) / 1000).toFixed(2)},${(resolvedImages[i].endTime / 1000).toFixed(2)})'[v${i}]`
    )
  }

  const inputs: string[] = resolvedImages.map(it => it.file)

  const fileLines = inputs.map(it => `  -t ${~~(totalLength / 1000)} -loop 1 -i ${'./screenshots/' + it} \\`).join('\n')
  const filterComplex = filters.map(it => '  ' + it).join(';\n')
  
  const commands = `
ffmpeg \\
  -t ${~~(totalLength / 1000)} -f lavfi -i color=c=blue:s=${WIDTH}x${HEIGHT} \\
${fileLines}
  -filter_complex "
${filterComplex}
" \\
  -c:v libx264 \\
  -map "[v${resolvedImages.length - 1}]" \\
  -s ${WIDTH}x${HEIGHT} \\
  out.mp4
`

  await fs.writeFile(shellCommandsFile, commands)

  await fs.writeFile(ffmpegCommandsFile, scriptLines.map(it => {
    return it.time + '\n' + it.items.map(item => item.join(' ')).join(',\n') + ';'
  }).join('\n\n'))
}

main()