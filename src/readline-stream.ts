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

    // if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

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

// function ReadlineStream(options)
// {
//   if(!(this instanceof ReadlineStream))
//     return new ReadlineStream(options);

//   ReadlineStream.super_.call(this, options)


//   const re = options.re || splitting_re

//   // use objectMode to stop the output from being buffered
//   // which re-concatanates the lines, just without newlines.
//   this._readableState.objectMode = true;

//   var lineBuffer = '';

//   // take the source's encoding if we don't have one
//   this.on('pipe', function(src) {
//     if (!this.encoding) {
//       this.encoding = src._readableState.encoding;
//     }
//   });

//   this._transform = function(chunk, encoding, done)
//   {
//     // decode binary chunks as UTF-8
//     if(Buffer.isBuffer(chunk))
//     {
//       if(!encoding || encoding == 'buffer') encoding = 'utf8';

//       chunk = chunk.toString(encoding);
//     }

//     lineBuffer += chunk;
//     var lines = lineBuffer.match(re);

//     while(lines.length > 1)
//       this.push(lines.shift())

//     lineBuffer = lines[0] || '';

//     done();
//   };

//   this._flush = function(done)
//   {
//     if(lineBuffer)
//     {
//       this.push(lineBuffer)
//       lineBuffer = ''
//     }

//     done();
//   };
// }
// inherits(ReadlineStream, Transform);


// module.exports = ReadlineStream;
