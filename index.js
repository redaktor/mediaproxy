/* TODO
audio/* WIP
video/* mp4, webm, ogg, should qt mov still be supported (ended w. 10.15)
native http://atomicparsley.sourceforge.net/mpeg-4files.html
jsmediatag
html  see JSON LD parser + https://github.com/wikimedia/html-metadata
*/

// see NOTE https://github.com/Rob--W/cors-anywhere/issues/254#issuecomment-659037020
const corsAnywhere = require('cors-anywhere');
const express = require('express');
const apicache = require('apicache');
const path = require('path');
const expressHttpProxy = require('express-http-proxy');
const exifr = require('exifr');
const { urls } = require('./meta');
const defaultContext = require('./context').defaultContext;
const Image = require('./sources/image');
const { sizeRegexStr, operationRegexStr, outputRegexStr, image } = Image;
const Video = require('./sources/video');
const { video } = Video;
/* PORT FOR PROXY */
const CORS_PROXY_PORT = 5000;
/* PORT FOR DEMO; can be overwritten by process.env.PORT */
const PUBLIC_APP_PORT = 8080;

const TYPE = {
  PNG: 'image/png',
  JSON: 'application/json',
  LDJSON: 'application/ld+json'
};
const acceptsJSON = (req) => !!req.accepts(TYPE.JSON) || !!req.accepts('json');
const acceptsLDJSON = (req) => !!req.accepts(TYPE.LDJSON);
const isPlainJSONmeta = (req) => !acceptsLDJSON(req) && acceptsJSON(req);
const isJSON = (req, mediaType) => !req.accepts(mediaType) && (acceptsJSON(req) || acceptsLDJSON(req));
const getMediaType = (res) => (!res.get('content-type') ? TYPE.PNG : res.get('content-type')).toLowerCase();
/**
 * Construct the caching middleware
 */
function cacheMiddleware() {
  const cacheOptions = {
    statusCodes: { include: [200] },
    defaultDuration: 60000,
    appendKey: (req, res) => {
      const isJSONkey = isJSON(req, getMediaType(res));
      if (isJSONkey) {
        const origUrl = `${req.originalUrl}$$appendKey=${req.method}`;
        const hasSameType = !!apicache.getIndex().all.filter((k) => k === origUrl).length;
        // console.log(hasSameType);
        if (!hasSameType) {
          console.log('trigger mediaType')
        }
      }
      // console.log(isJSONkey, apicache.getIndex())
      return `${req.method}${isJSONkey ? '.json' : ''}`
    }
  };
  let cacheMiddleware = apicache.options(cacheOptions).middleware();
  return cacheMiddleware;
}

// Create CORS Anywhere server
corsAnywhere.createServer({}).listen(CORS_PROXY_PORT, () => {
  console.log(
    `Internal CORS Anywhere server started at port ${CORS_PROXY_PORT}`
  );
});

// Create express Cache server
let app = express();
// Register cache middleware for GET and OPTIONS verbs
app.get('/*', cacheMiddleware());
app.options('/*', cacheMiddleware());

// Proxy to CORS server when request misses cache
/*
// method: width/w height/h cover contain fill
// options.withoutEnlargement
*/
const methodsRegexStr = `${sizeRegexStr}|${operationRegexStr}|${outputRegexStr}`;
const methodsRegex = new RegExp(methodsRegexStr);

const ROUTE = [0,1,2,3,4,5,6].map((i) => !i ? `/:op0(${methodsRegexStr})/:a0?/:b0?` :
  `/:op${i}?/:a${i}?/:b${i}?`).join('')+'/';

app.use(ROUTE, expressHttpProxy(`localhost:${CORS_PROXY_PORT}`, {
  preserveHostHdr: true,
  userResDecorator: async (proxyRes, proxyResData, req, res) => {
    const fallback = proxyResData;

    let contentType;
    console.log('content-type',res.get('content-type'))
    if (!res.get('content-type')) {
      const [reqUrl, proxyUrl] = urls(req, proxyRes);
      const possibleExtension = path.basename(proxyUrl).split('#')[0].split('?')[0].slice(-4);
      if (possibleExtension.slice(0,1) === '.') {
        const extension = possibleExtension.slice(1)
        console.log(extension)
        if (Image.inputs.hasOwnProperty(extension)) {
          res.set('content-type', `image/${Image.inputs[extension]}`);
        } else if (Video.inputs.hasOwnProperty(extension)) {
          res.set('content-type', `video/${Video.inputs[extension]}`);
        }
      }
    }

    try {
      const mediaType = (!res.get('content-type') ? TYPE.PNG : res.get('content-type')).toLowerCase();
      const [mainType, subType] = mediaType.split('/');
console.log(mainType, subType)

// TODO:
      if (mainType !== 'image' && mainType !== 'video') { return fallback }
      let metaOutput;
      switch (mainType) {
        case 'image':
          metaOutput = await image(proxyRes, proxyResData, req, res);
        case 'video':
          metaOutput = await video(proxyRes, proxyResData, req, res);
      }

      // console.log(_meta, JSON.stringify(_meta.context, null, 2));
      const {meta: _meta, output} = metaOutput;

// TODO !!! meta -> filename and filesize // languages in e.g. video tracks

// TODO - always cache output
      if (isJSON(req, mediaType)) {
        const meta = isPlainJSONmeta(req) ? _meta : {'@context': defaultContext, ..._meta}
        res.set('content-type', acceptsLDJSON(req) ? TYPE.LDJSON : TYPE.JSON)
        return JSON.stringify(meta, null, 2)+'\n';
      }
// if (!req.accepts(mediaType)) ---> 404
      return output
    } catch(e) {
      console.log('!error ', e);
      return fallback
    }
  }
}));

/*
app.get("https://sebastianlasse.de/movXmp2.mp4", (req, res) => {
    https.get(mp4Url, (stream) => {
        stream.pipe(res);
    });
});
*/

const APP_PORT = process.env.PORT || PUBLIC_APP_PORT;
app.listen(APP_PORT, () => {
  console.log(`External CORS cache server started at port ${APP_PORT}`);
  console.log(' ');
  console.log('Supported image/* type for input:');
  console.log('\x1b[42m\x1b[30m%s\x1b[0m', `${Object.keys(Image.inputs).map((k) => {
    return `image/${k}`
  }).concat(Object.keys(Video.inputs).map((k) => {
    return `video/${k}`
  })).join(', ')} `);
  console.log('Supported image/* output:');
  console.log('\x1b[42m\x1b[30m%s\x1b[0m', `${Object.keys(Image.outputs).map((k) => {
    return `image/${k}`
  }).concat(Object.keys(Video.outputs).map((k) => {
    return `video/${k}`
  })).join(', ')} `);
  console.log(' ');
});
