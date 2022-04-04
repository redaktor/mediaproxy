const path = require('path');
const sharp = require('sharp');
const exifr = require('exifr');
const meta = require('../meta');
const { getPrefixObject, getLD, baseInfo } = meta;
/* TODO
blurhash : exif:SubjectLocation exif:SubjectArea

// Iptc4xmpExt:PersonInImage Text
// Iptc4xmpExt:OrganisationInImageName Text
// Iptc4xmpExt:ProductInImage [Bag Product structure <External>]
// photoshop:TextLayers [{LayerName, LayerText}, ]

*/

/* IF OUTPUT TYPE INVALID; or (depending on libvips) if input can't be used for output */
const INPUT_FALLBACK = 'jpg';
const OUTPUT_FALLBACK = 'png';
const EXIFR_OPTIONS = {
  // Segments (JPEG APP Segment, PNG Chunks, HEIC Boxes, etc...)
  tiff: true,
  xmp: true,
  icc: true,
  iptc: true,
  jfif: true, // (jpeg only)
  ihdr: true, // (png only)
  // Sub-blocks inside TIFF segment
  ifd0: true, // aka image
  ifd1: true, // aka thumbnail
  exif: true,
  gps: true,
  interop: true,
  // Other TIFF tags
  makerNote: false,
  userComment: true,
  // Filters
  skip: [],
  pick: [],
  // Formatters
  translateKeys: true,
  translateValues: true,
  reviveValues: true,
  sanitize: true,
  mergeOutput: false,
  silentErrors: true,
  // Chunked reader
  chunked: true,
  firstChunkSize: undefined,
  firstChunkSizeNode: 512,
  firstChunkSizeBrowser: 65536, // 64kb
  chunkSize: 65536, // 64kb
  chunkLimit: 5,
  httpHeaders: {},
};

/* Resize parameters */
const whShortcuts = {
  thumb: 80,
  preview: 240,
  column: 600,
  page: 1280,
  hd: 1920
};
const containPosition = {
  top: 'top', right: 'right', bottom: 'bottom', left: 'left',
  righttop: 'right top', topright: 'right top',
  rightbottom: 'right bottom', bottomright: 'right bottom',
  leftbottom: 'left bottom', bottomleft: 'left bottom',
  lefttop: 'left top', topleft: 'left top',
  north: 'north', northeast: 'northeast',
  east: 'east', southeast: 'southeast',
  south: 'south', southwest: 'southwest',
  west: 'west', northwest: 'northwest',
  centre: 'centre', center: 'centre', middle: 'centre',
};
const coverPosition = {
  ...containPosition,
  entropy: 'entropy',
  attention: 'attention'
};
const sizeMethods = {
  width: 'width',
  w: 'width',
  height: 'height',
  h: 'height',
  cover: 'cover',
  contain: 'contain',
  fill: 'fill'
};
exports.sizeRegexStr = `${Object.keys(sizeMethods).join('|')}`;

/* Operations parameters */
const operations = {
  rotate: 'rotate', flip: 'flip', flop: 'flop', sharpen: 'sharpen', blur: 'blur',
  median: 'median', flatten: 'flatten', gamma: 'gamma', negate: 'negate', linear: 'linear',
  clahe: 'clahe', modulate: 'modulate', normalise: 'normalise', normalize: 'normalise',
  tint: 'tint', desaturate: 'desaturate', grayscale: 'grayscale', greyscale: 'greyscale',
  withmetadata: 'withMetadata'
};
exports.operationRegexStr = `${Object.keys(operations).join('|')}`;

/* Output parameters */
const outputSwitches = {
  jpeg: { mozjpeg: 1, progressive: 1, optimiseScans: 1 },
  png: { progressive: 1 },
  webp: { lossless: 1, nearLossless: 1, smartSubsample: 1 },
  jp2: { lossless: 1 },
  avif: { lossless: 1 },
  heif: { lossless: 1 }
}
// NOTE: The supported input and output formats slightly depend on how libvips is compiled;
const { format } = sharp;
exports.inputs = {};
exports.outputs = { jpg: 'jpeg', tif: 'tiff' };
for (const [key, o] of Object.entries(format)) {
  if (!!o.input && !!o.input.buffer) { exports.inputs[key] = key }
  if (!!o.output && !!o.output.buffer) { exports.outputs[key] = key }
}
exports.outputRegexStr = `${Object.keys(exports.outputs).join('|')}`;

const methodsRegex = new RegExp(`${exports.sizeRegexStr}|${exports.operationRegexStr}|${exports.outputRegexStr}`);
const { inputs, outputs } = exports;

exports.image = async function(proxyRes, proxyResData, req, res) {
  const {
    mediaType, mainType, subType, reqUrl, proxyUrl, acceptsJSON, isPlainJSONmeta
  } = baseInfo(req, res, proxyRes, INPUT_FALLBACK, OUTPUT_FALLBACK);
  const outputFallback = ['output', outputs.hasOwnProperty(subType) ? subType : outputFallback];

  let hasMetadata = false;
  let newData = proxyResData;
  const paramGroups = Object.values(req.params).reduce((a,_v,i,pa) => {
    if (!_v) { return a }
    const v = _v.toLowerCase();
    if (i < pa.length-3) {
      if (methodsRegex.test(v)) {
        const _a = [v];
        if (!methodsRegex.test(pa[i+1])) { _a.push(pa[i+1]) }
        if (!methodsRegex.test(pa[i+2])) { _a.push(pa[i+2]) }
        return a.concat([_a])
      }
    } else {
      return a.concat([[v, pa[i+1], pa[i+2]]]);
    }
    return a
  }, []).map((a) => {
    const [v, ...args] = a.filter((s) => !!s);
    if (v === 'withmetadata') { hasMetadata = true }
    const [type, method] = sizeMethods.hasOwnProperty(v) ? ['size', sizeMethods[v]] : (
      operations.hasOwnProperty(v) ? ['operation', operations[v]] : (
        outputs.hasOwnProperty(v) ? ['output', outputs[v]] : []
      )
    );
    return [type, method, ...args]
  }).filter((a) => !!a.length && !!a[0]);
  if (!!paramGroups.length && paramGroups[paramGroups.length-1][0] !== 'output') {
    paramGroups.push(outputFallback)
  }
  let meta = (!hasMetadata || (!req.accepts('application/ld+json') && !acceptsJSON)) ? {} :
    await exports.getMeta(newData, reqUrl, mediaType, proxyUrl, isPlainJSONmeta);

  newData = await sharp(newData).timeout({seconds: 8});
  for (let a of paramGroups) {
    const [type, methodOrOutput, ...args] = a;
    const options = argsFn[type](methodOrOutput, ...args);

    // console.log(type, methodOrOutput, options, (methodOrOutput in newData));
    if (type === 'size' && (!!options.width || !!options.height)) {
      newData = newData.resize(options)
    }
    if (type === 'operation' && (methodOrOutput in newData)) {
      const opArgs = options;
      newData = newData[methodOrOutput](...opArgs)
    }
    if (type === 'output') {
      newData = newData.toFormat(methodOrOutput, options)
    }
  }

  const output = await newData.toBuffer();
  // const withStats = await sharp(output).stats(); // dominant color …
  const withMeta = await sharp(output).metadata();
  if (meta.url && !!meta.url.length) {
    if (withMeta.width) { meta.url[0].width = withMeta.width }
    if (withMeta.height) { meta.url[0].height = withMeta.height }
  }

  return {meta, output}
}

function isValidNr(value) {
  return typeof value === 'number' && !isNaN(value)
}
function toColor(value) {
  return value.indexOf('rgb') > -1 ? value : `#${value}`
}
function parseSingleSize(size) {
  const value = whShortcuts.hasOwnProperty(size) ? whShortcuts[size] : parseInt(size, 10);
  if (isValidNr(value) && value > 0) {
    return value;
  }
  return 0
}
function vNumber(_v, defaultV = void 0) {
  const v = parseFloat(_v);
  return !isValidNr(value) ? defaultV : v
}
function vMinMax(_v, min, max, defaultV = void 0) {
  const v = parseFloat(_v);
  return !isValidNr(v) ? defaultV : Math.max(Math.min(max, v), min)
}
const argsFn = {
  size: (sizeMethod, sizeOrShortcut, position = 'centre') => {
    const o = {position};
    if (!sizeMethods.hasOwnProperty(sizeMethod)) { return o }
    if (sizeMethod === 'width' || sizeMethod === 'height') {
      o.fit = 'cover';
      o[sizeMethod] = parseSingleSize(sizeOrShortcut);
      return o
    }
    o.fit = sizeMethod;
    let [w,h] = sizeOrShortcut.split('x');
    w = parseSingleSize(w);
    if (isValidNr(w) && w > 0) {
      o.width = w;
      const _h = parseSingleSize(h);
      o.height = (isValidNr(_h) && _h > 0) ? _h : w;
    }
    const pos = position.toLowerCase();
    if (!!pos) {
      if (options.fit === 'cover' && coverPosition.hasOwnProperty(pos)) {
        options.position = coverPosition[pos];
      } else if (options.fit === 'contain' && containPosition.hasOwnProperty(pos)) {
        options.position = containPosition[pos];
      }
    }
    return o
  },
  operation: (op, value, optional) => {
    if (!operations.hasOwnProperty(op)) { return [] }
    const options = {};
    let operation = operations[op];
    // special shortcuts
    if (operation === 'desaturate') {
      operation = 'modulate';
      value = '1_0'
    }
    switch(operation) {
      case 'rotate':
        // angle; If provided, it is converted to a valid positive degree rotation. E.g., -450 will produce 270
        if (!value) { return [] }
        if (optional) { options.background = optional }
        return [vNumber(value), options];
      case 'blur':
        // a value between 0.3 and 1000 representing the sigma of the Gaussian mask, where sigma = 1+radius/2
        if (!value) { return [] }
        return [vMinMax(value, 0.3, 1000)];
      case 'sharpen':
        // sigma_flat?_jagged?
        // sigma number ? the sigma of the Gaussian mask, where sigma = 1 + radius / 2.
        // flat number  the level of sharpening to apply to "flat" areas. (optional, default 1.0)
        // jagged number  the level of sharpening to apply to "jagged" areas. (optional, default 2.0)
        if (!value) { return [] }
        const [sigma, flat = 1, jagged = 2] = value.split('_');
        return [vMinMax(sigma, 0.3, 1000), vNumber(flat), vNumber(jagged)];
      case 'linear':
        // a:number  multiplier (optional, default 1.0)
        // b:number  offset (optional, default 0.0)
        if (!value) { return [] }
        return [vMinMax(value, 1, 3), !!optional ? vMinMax(optional, 1, 3) : void 0];
      case 'tint':
        if (!value) { return [] }
        return [toColor(value)];
      case 'gamma':
        // gamma number value between 1.0 and 3.0. (optional, default 2.2)
        // gamma out number value between 1.0 and 3.0. (optional, default 2.2)
        if (!value) { return [] }
        return [vMinMax(value, 1, 3), !!optional ? vMinMax(optional, 1, 3) : void 0];
      case 'median':
        // size x size (optional, default 3)
        if (!value) { return [] }
        return [vNumber(value)];
      case 'flatten':
        // background? hex color
        if (!value) { return [] }
        options.background = toColor(value);
        return [options];
      case 'negate':
        // noalpha Do not negate any alpha channel
        return value.toLowerCase() === 'noalpha' ? [{alpha: false}] : []
      case 'clahe':
        // width_height_maxSlope?
        // options.width number  integer width of the region in pixels.
        // options.height number  integer height of the region in pixels.
        // options.maxSlope number  maximum value for the slope of the cumulative histogram:
        // A value of 0 disables contrast limiting. Range 0-100 (inclusive) (optional, default 3)
        if (!value) { return [] }
        const [width, height, maxSlope = 3] = value.split('_');
        return [{
          width: vNumber(width), height: vNumber(height), maxSlope: vMinMax(maxSlope, 0, 100)
        }];
      case 'modulate':
        // brightness_saturation_hue_lightness
        // options.brightness number ? Brightness multiplier
        // options.saturation number ? Saturation multiplier
        // options.hue number ? Degrees for hue rotation
        // options.lightness number ? Lightness addend
        if (!value) { return [] }
        const [brightness, saturation, hue, lightness] = value.split('_');
        return [{
          brightness: vNumber(brightness),
          saturation: vNumber(saturation),
          hue: vNumber(hue),
          lightness: vNumber(lightness)
        }];
      case 'withMetadata':
        // orientation; between 1 and 8, used to update the EXIF Orientation tag.
        if (!value) { return [] }
        return [vMinMax(value, 1, 8)];
      default:
        return [true]
    }
  },
  output: (format, qualityOrColorsStr, _booleans = '') => {
    if (!qualityOrColorsStr || !outputs.hasOwnProperty(format)) { return [] }
    format = outputs[format];
    const minQ = format === 'gif' ? 2 : 1;
    const maxQ = format === 'gif' ? 256 : 100;
    const quality = parseInt(qualityOrColorsStr, 10);
    const options = {quality: vMinMax(quality, minQ, maxQ, format === 'gif' ? 256 : 50)};
    if (format === 'tiff' && (_booleans === '1' || _booleans === '2' || _booleans === '4')) {
      options.bitdepth = parseInt(_booleans, 10);
    } else if ((format === 'gif' || format === 'webp') && _booleans.indexOf('loop') > -1) {
      const [_ = false, _loop, _delay] = _booleans.match(/loop(\d*)?_?(\d*)?/i);
      if (!!_) {
        _booleans = _booleans.replace(_,'');
        const [loop = 0, delay] = [parseInt(_loop, 10), parseInt(_delay, 10)];
        if (isValidNr(loop)) { options.loop = loop }
        if (isValidNr(delay)) { options.delay = delay }
      }
    }
    const booleans = _booleans.split('_');
    for (let boolKey of booleans) {
      if (outputSwitches.hasOwnProperty(format) && outputSwitches[format].hasOwnProperty(boolKey)) {
        options[boolKey] = true
      }
    }
    return [options]
  }
}

function mapLegacyValues(o) {
  if (typeof o !== 'object') { return }
  // old IPTC
  [
    ['dc','description','Caption'], ['dc','rights','CopyrightNotice'], ['dc','creator','Byline'],
    ['photoshop','TransmissionReference','OriginalTransmissionReference'],
    ['photoshop','CaptionWriter','Writer'], ['photoshop','Instructions','SpecialInstructions']
  ].forEach((a, i) => {
    const [vocab, ldKey, iptcOrOtherKey] = a;
    const hasLDdefault = o.hasOwnProperty(vocab) && o[vocab].hasOwnProperty(ldKey) && !!o[vocab][ldKey];
    if (!hasLDdefault && o.hasOwnProperty('iptc') && o.iptc.hasOwnProperty(iptcOrOtherKey)) {
      if (!o.hasOwnProperty(vocab) || typeof o[vocab] !== 'object' || Array.isArray(o[vocab]) || !o[vocab]) {
        o[vocab] = {}
      }
      o[vocab][ldKey] = o.iptc[iptcOrOtherKey];
    }
  });
  return o
}
exports.getMeta = async (data, reqUrl, mediaType, linkName = '', plainJSON = false) => {
  const parsed = await exifr.parse(data, EXIFR_OPTIONS);
  // never parse maker notes; e.g. in case EXIFR_OPTIONS === true
  if (parsed.hasOwnProperty('makerNote')) { delete parsed.makerNote }
  for (let [key, value] of Object.entries(parsed)) {
    if (value instanceof Uint8Array) {
      const strValue = new TextDecoder().decode(value).replace(/^ASCII/,'').replace(/\0/g, '').trim();
      if (!!strValue) {
        parsed[key] = strValue
      } else {
        delete parsed[key]
      }
    }
  }
  if (!!plainJSON) { return getPrefixObject(parsed) }
  const parsedLD = getLD(mapLegacyValues(parsed), reqUrl, mediaType, linkName);
  if (!parsedLD.name) { parsedLD.name = [path.basename(linkName)] }
  return parsedLD
}
