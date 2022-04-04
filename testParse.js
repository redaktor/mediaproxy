const xmp = require('./xmp');
const meta = require('../meta');
const { metaProperties, getLD: getBaseLD } = meta;
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

const mp4toLD = { /* [ldVocab, ldKey, asKey?, asExtraType?] */
  '©nam': ['dc', 'title', 'name'],
  desc:   ['dc', 'description', 'summary'],
  ldes:   ['dc', 'description', 'content'],
  '©cmt': ['xmpDM', 'comment', 'content'],
  keyw:   ['dc', 'title', 'tag'],
  catg:   ['dc', 'title', 'tag'],
  '©day': ['xmpDM', 'releaseDate'],
  '©alb': ['xmpDM', 'album', 'context', 'Album'],
  '©gen': ['xmpDM', 'genre', 'context', 'Genre'],
  gnre:   ['xmpDM', 'genre', 'context', 'Genre'],
  '©grp': ['xmpDM', 'projectName', 'context', 'ProjectName'],
  catg:   ['Iptc4xmpCore', 'IntellectualGenre', 'context'],
  cprt:   ['dc', 'rights', 'attributedTo'],
  aART:   ['dc', 'contributor', 'attributedTo', 'AlbumArtist'],
  '©ART': ['xmpDM', 'artist', 'attributedTo', 'Artist'],
  '©wrt': ['xmpDM', 'composer', 'attributedTo', 'Composer'],
  '©enc': ['xmpDM', 'engineer', 'attributedTo', 'EncodedBy'],
  xid:   ['xmpRights', 'Owner', 'attributedTo', 'Owner'],
  '©too': ['xmp', 'CreatorTool', 'generator'],
  '©lyr': ['xmpDM', 'lyrics', 'instrument'],
  tmpo:   ['xmpDM', 'tempo', 'instrument'],
  rtng:   ['xmp', 'Rating'],
  cpil:   ['xmpDM', 'partOfCompilation'],
  disk:   ['xmpDM', 'discNumber'],
  trkn:   ['xmpDM', 'trackNumber'],
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
exports.getMeta = async (_data, reqUrl, mediaType, linkName = '', plainJSON = false) => {
  let o = {};
  const META = await xmp.find(_data);
  const {xmp: XMP, data} = META;

	const mp4 = await import('./mp4/mp4.mjs');
	const buf = new Uint8Array(Buffer.concat(data));
  console.log(buf);
	const MP4 = await mp4.readMovieAtom(buf);

  const {type = '', ftyp = '', version = 0, minorVersion = 0, compatibleBrands = [], tags = {}} = MP4||{};
  o = {type, ftyp, version, minorVersion, compatibleBrands, as: {}, MP4, ...XMP};
  const entriesXMP = Object.entries(XMP);

  const entriesMP4 = Object.entries(tags);
  const mp4toLDvalues = Object.values(mp4toLD);
  for (let [k, v] of entriesMP4) {
    if (!mp4toLD.hasOwnProperty(k)) { continue }

    const [ldVocab, ldKey, asKey = '', asExtraType = ''] = mp4toLD[k];
    if (!o.hasOwnProperty(ldVocab)) { o[ldVocab] = {} }
    if (!o[ldVocab].hasOwnProperty(ldKey)) {
      o[ldVocab][ldKey] = v;
    }

    if (!!asKey && v) {
      if (!o.hasOwnProperty('as')) { o.as = {} }
      if (asKey === 'context') {
        o.as.context = (o.as.context||[]).concat(asObject(mp4toLD[k], v))
      } else if (asKey === 'attributedTo') {
        o.as.attributedTo = (o.as.attributedTo||[]).concat(asObject(mp4toLD[k], v, 'Organization'))
      } else {
        for (let [xmpldVocab, xmpO] of entriesXMP) {
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
/* covr is raw image data, e.g. try:
  if (o.MP4 && o.MP4.tags && o.MP4.tags.covr) {
    const img = await mp4.coverToFile(o.MP4.tags.covr);
    console.log(img)
  }
*/
  return o
}

// './test/data/horizontal.mp4' movXmp2
exports.getLD = async function getLD(
  data, href, mediaType, name = '', metaProperties = _dmMetaProperties
) {
  const ld = getBaseLD(data, href, mediaType, name, metaProperties);
  if (Array.isArray(ld.type)) { ld.type = ld.type.map((s) => s === 'Image' ? 'Video' : s) }
  return ld
}
// https://sebastianlasse.de/movXmp2.mp4
// ./data/movXmp2.mp4
exports.getMeta('./data/movXmp2.mp4').then((o) => {
  console.log('o', o);
  console.log('json as', JSON.stringify(o.as, null, 2));
  exports.getLD(o).then((ldo) => console.log('ld',ldo));
});
