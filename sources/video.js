const path = require('path');
// const sharp = require('sharp'); // TODO cover
const meta = require('../meta');
const xmp = require('./xmp');
const { metaProperties, getLD: getBaseLD, baseInfo } = meta;

exports.inputs = {
  '3gpp': 'mp4', '3gpp2': 'mp4', 'enc-isoff-generic': 'mp4', jp2: 'mp4', mj2: 'mp4',
  mkv: 'mkv', mov: 'mp4', mp4: 'mp4', quicktime: 'mp4', 'vnd.dvb.file': 'mp4',
  webm: 'webm', 'x-m4a': 'mp4', 'x-m4v': 'mp4', 'x-matroska': 'mkv'
};
exports.outputs = { mp4: 'mp4', webm: 'webm' };
exports.outputRegexStr = `${Object.keys(exports.outputs).join('|')}`;
const INPUT_FALLBACK = 'mp4';
const OUTPUT_FALLBACK = 'mp4';
const _dmMetaProperties = {
  ...metaProperties,
  xmpDM: {

  }
};
exports.dmMetaProperties = _dmMetaProperties;

const toArray = (v) => typeof v === 'undefined' ? [] : (Array.isArray(v) ? v : [v]);
const toNameNote = (name) => [{ type: ['Note'], name }];
const asObject = (a, name, baseType = 'Object') => {
  const [vocab, key, as = 'context', id] = a;
  if (!id) { id = key }
  const ids = id.split(':');
  const rId = ids[ids.length-1];
  return [{ type: [baseType, `redaktor:${rId}`], name }]
}

const whDuration = (mainO, keys = ['width', 'height', 'duration'], asO = {}) => {
  for (let k of keys) {
    if (mainO.hasOwnProperty(k)) {
      asO[k] = k === keys[2] ? `PT${Math.round(mainO.duration/1000)}S` : mainO[k];
    }
  };
  return asO
}
const mapToNamespacePrefix = (o, _xmp, _tags, mapping) => {
  const [xmp, tags] = [Object.entries(_xmp), Object.entries(_tags)];
  for (let [k, v] of tags) {
    if (!mapping.hasOwnProperty(k)) { continue }
    const [ldVocab, ldKey, asKey = '', asExtraType = ''] = mapping[k];
    if (!o.hasOwnProperty(ldVocab)) { o[ldVocab] = {} }
    if (!o[ldVocab].hasOwnProperty(ldKey)) {
      o[ldVocab][ldKey] = v;
    }

    if (!!asKey && v) {
      if (!o.hasOwnProperty('as')) { o.as = {} }
      if (asKey === 'context') {
        o.as.context = (o.as.context||[]).concat(asObject(mapping[k], v))
      } else if (asKey === 'attributedTo') {
        o.as.attributedTo = (o.as.attributedTo||[]).concat(asObject(mapping[k], v, 'Organization'))
      } else {
        for (let [xmpldVocab, xmpO] of xmp) {
          if (xmpldVocab === ldVocab && xmpO.hasOwnProperty(ldKey)) {
            o.as[asKey] = toArray(xmpO[ldKey]);
          }
        }
        if (Array.isArray(o.as[asKey])) {
          o.as[asKey] = Array.from(new Set(o.as[asKey].concat(toArray(v))))
        } else if (!o.as.hasOwnProperty(asKey)) {
          o.as[asKey] = toArray(v);
        }
      }
    }
  }
  return o
}
/*
const contextKeys = ['photoshop:TransmissionReference', 'Iptc4xmpCore:Scene'];
const tagKeys = ['dc:subject', 'Iptc4xmpCore:SubjectCode', 'photoshop:Category', 'photoshop:SupplementalCategories'];
"sfID": "Country Code", -> location.name
"covr": "Cover Art", -> image
*/
/*
schema
  TVClip
  partOfEpisode	Episode	The episode to which this clip belongs.
  partOfSeason	CreativeWorkSeason	The season to which this episode belongs.
  partOfSeries
"tven": "TV Episode ID",
"tves": "TV Episode",
"tvsn": "TV Season",
"tvsh": "TV Show Name",
schema:TelevisionChannel
"tvnn": "TV Network",
schema:associatedMedia
"pcst": "Podcast",
"purl": "Podcast URL",

"sonm": "Sort Name",
"soar": "Sort Artist",
"soaa": "Sort Album",
"soco": "Sort Composer",
"sosn": "Sort Show",
"atID": "Artist ID",
"cnID": "Catalog ID",
"plID": "Collection ID",
"geID": "Genre ID",
"purd": "Purchase Date",
"hdvd": "HD Video",
"stik": "Media Type",
"pgap": "Gapless Playback",
"apID": "Purchase Account",
};

tags: {
   '©too': {
     id: '©too',
     size: 37,
     description: 'Encoding Tool',
     data: 'Lavf58.76.100'
   }
 }
*/
exports.webm = async (data, XMP) => {
  const { getMeta, mkvToLD } = await import('./ebml/index.js');
	const MKV = await getMeta(data);
  const { info = {}, tags = {}, tracks = [] } = MKV||{};
  const { DocType: type = '', EBMLVersion: version = 0, compatibleBrands = ['mkv'] } = MKV.EBML||{};
  let o = {type, version, compatibleBrands, as: whDuration(MKV), MKV, ...XMP};
  if (!!info.Title) {
    o.as.name = [info.Title];
  }
  // EBML is a tree, so can be tags …
  if (tags.hasOwnProperty('Movie')) {
    o = mapToNamespacePrefix(o, XMP, tags.Movie, mkvToLD)
  }

// (location) RECORDING_LOCATION, COMPOSITION_LOCATION, COMPOSER_NATIONALITY


/* info: {
  TimecodeScale: 1000000,
  MuxingApp: 'libebml v1.3.10 + libmatroska v1.5.2',
  WritingApp: "mkvmerge v44.0.0 ('Domino') 64-bit",
  Duration: 32490,
  DateUTC: 2022-03-21T10:50:33.000Z,
  Title: 'This is the Title'
},
tags: {
*/

  return mapToNamespacePrefix(o, XMP, tags, mkvToLD)
}
exports.mkv = exports.webm;
exports.ogg = async (data, XMP) => {

}
exports.mp4 = async (data, XMP) => {
  const { getMeta, mp4ToLD } = await import('./mp4/mp4.mjs');
	const MP4 = await getMeta(data);
  const {type = '', ftyp = '', version = 0, minorVersion = 0, compatibleBrands = [], tags = {}} = MP4||{};
  const o = {type, ftyp, version, minorVersion, compatibleBrands, as: whDuration(MP4), MP4, ...XMP};
  /* covr is raw image data, e.g. try:
    if (o.MP4 && o.MP4.tags && o.MP4.tags.covr) {
      const img = await mp4.coverToFile(o.MP4.tags.covr);
      console.log(img)
    }
  */
  return mapToNamespacePrefix(o, XMP, tags, mp4ToLD)
}

exports.getMeta = async (_data, reqUrl, mediaType, linkName = '', plainJSON = false) => {
  const [mainType, subType] = mediaType.split('/');
  const videoType = subType.toLowerCase();
  // console.log(videoType);
  try {
    const META = await xmp.find(_data)
    const {data = _data, xmp: xmpInfo = {}} = META||{};
    const type = inputs.hasOwnProperty(videoType) && inputs[videoType];

    if (!!type && exports.hasOwnProperty(type)) {
      return exports[type](data, xmpInfo)
    }
  } catch(e) { console.log(e) }
  return {};
}

// './test/data/horizontal.mp4' movXmp2
exports.getLD = async function getLD(
  data, href, mediaType, name = '', metaProperties = _dmMetaProperties
) {
  const ld = getBaseLD(data, href, mediaType, name, metaProperties);
  if (Array.isArray(ld.type)) { ld.type = ld.type.map((s) => s === 'Image' ? 'Video' : s) }
  return ld
}

const methodsRegex = new RegExp(`${exports.sizeRegexStr}|${exports.operationRegexStr}|${exports.outputRegexStr}`);
const { inputs, outputs } = exports;
exports.video = async function(proxyRes, proxyResData, req, res) {
  const {
    mediaType, mainType, subType, reqUrl, proxyUrl, acceptsJSON, isPlainJSONmeta
  } = baseInfo(req, res, proxyRes, INPUT_FALLBACK, OUTPUT_FALLBACK);
  const outputFallback = ['output', outputs.hasOwnProperty(subType) ? subType : OUTPUT_FALLBACK];
  let hasMetadata = true; /* TODO withMetadata */
  let newData = proxyResData;
  let meta = (!hasMetadata || (!req.accepts('application/ld+json') && !acceptsJSON)) ? {} :
    await exports.getMeta(newData, reqUrl, mediaType, proxyUrl, isPlainJSONmeta);

  return {meta, output:''}

}
