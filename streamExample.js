/* eslint no-console:off */
async function readFile(file) {
  const { ReadableStream, TransformStream } = await import('node:stream/web');
  const { Readable } = await import('stream');
  const { Decoder } = await import('./sources/ebml/decoder.js');
  const fs = await import('fs');
  console.log(Decoder);

  class NodeToWebStream {
    constructor(stream) {
      this.stream = stream
      this._disturbed = false

      stream.pause()
    }

    getReader() {
      return new StreamReader(this.stream)
    }
  }

  class StreamReader {
    constructor(stream) {
      this.stream = stream
    }

    [Symbol.asyncIterator]() {
      return {
        next: this.read.bind(this),
      }
    }

    read() {
      const {stream} = this
      stream._disturbed = true

      return new Promise((resolve, reject) => {
        stream.resume()
        stream[Symbol.asyncIterator]()
        .next()
        .then(resolve, reject)
      })
    }

    releaseLock() {
      this.stream = null
    }
  }






  const transform = new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk.toUpperCase());
    }
  });

  const writer = transform.writable.getWriter();
  const reader = transform.readable.getReader();

  const ws = new ReadableStream(new NodeToWebStream(fs.createReadStream(file)));
  //const transformedStream = ws.pipeThrough(ebmlDecoder);
  //console.log(transformedStream);
  for await (const chunk of ws) writer.write(chunk);

  console.log(await reader.read());
}
//readFile('./data/movTags.mkv')


async function readFileX(file) {
  const { ReadableStream, TransformStream } = await import('node:stream/web');
  const { Readable } = await import('stream');
  const { Decoder } = await import('./sources/ebml/decoder.js');
  const fs = await import('fs');
  const ebmlDecoder = new Decoder();
  const ebmlWriter = ebmlDecoder.writable.getWriter();
  const ebmlReader = ebmlDecoder.readable.getReader();
  fs.readFile(file, (err, data) => {
    if (err) {
      throw err;
    }
    ebmlWriter.write(data);
  });
  console.log(await ebmlReader.read());
}
readFileX('./data/movTags.mkv')
