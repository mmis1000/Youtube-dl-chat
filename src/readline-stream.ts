// Based on 'byline' transform from John Hewson

import { Transform } from "stream";

var splitting_re = /.*?(?:\r\n|\r|\n)|.+?$/g;
//var splitting_re = /.*?(?:\r\n|\r|\n)|.+?$|^$/g;


export class ReadlineStream  extends Transform {
  lineBuffer: string = ''
  re: RegExp
  constructor (options: { re?: RegExp }) {
    super({ readableObjectMode: true, writableObjectMode: false })
    this.re = options.re || splitting_re

    this.on('pipe', (src) => {
      if (!this.readableEncoding) {
        this.setEncoding(src.readableEncoding)
      }
    });
  }


  _transform(chunk: string | Buffer, encoding: BufferEncoding | 'buffer' | undefined, done: () => void) {
    // decode binary chunks as UTF-8
    if(Buffer.isBuffer(chunk))
    {
      if(!encoding ||encoding === 'buffer') encoding = 'utf8';

      chunk = chunk.toString(encoding);
    }

    this.lineBuffer += chunk;

    let lines = this.lineBuffer.match(this.re)!;

    while(lines.length > 1) {
      const line = lines.shift()!

      this.push(line)
    }

    this.lineBuffer = lines[0] || '';

    done();
  };

  _flush (done: () => void) {
    if(this.lineBuffer)
    {
      this.push(this.lineBuffer)
      this.lineBuffer = ''
    }

    done();
  };
}
