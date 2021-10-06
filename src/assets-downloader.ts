import type fetch from 'node-fetch'
import mime from 'mime';
import { createWriteStream, promises as fs } from 'fs'

export const createDownloadImage = (fetchImpl: typeof fetch) => {
  return async (imageURL: string, imageDirectory: string): Promise<string> => {
    const imageName = imageURL.split('/').pop()
    const imagePath = imageDirectory + '/' + imageName

    try {
      const res = await fs.stat(imagePath)

      if (res.isFile()) {
        return imagePath
      }
    } catch (err) { }

    const res = await fetchImpl(imageURL)


    const type = res.headers.get("Content-Type") ?? ''
    const extension = mime.getExtension(type) ?? 'dat'

    const outputFilePath = imagePath + '.' + extension
    const outputFileName = imageName + '.' + extension

    await fs.writeFile(imagePath, JSON.stringify({ file: outputFileName, mime: type }) + '\n')

    await new Promise((resolve, reject) => {
      res.body.on('error', reject)
      res.body.on('end', resolve)
      res.body.pipe(createWriteStream(outputFilePath)).on('error', reject)
    })



    return imagePath
  }
}