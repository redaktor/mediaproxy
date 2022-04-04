'use strict';
const toNameNote = (name) => ({ type: ['Note'], name });
const toArray = (v) => typeof v === 'undefined' ? [] : (Array.isArray(v) ? v : [v]);
const getAStypes = (dcType = [], force = [], fallback = []) => {
  const dcTypes = toArray(dcType).reduce((a,t) => {
    return a.concat(dcTypes.hasOwnProperty(t) ? [dcTypes[t],`dc:${t}`] : [`dc:${t}`])
  }, []).filter((v) => !!v);
  const types = toArray(force).concat(dcTypes);
  return !!types.length ? types : fallback
}
const getDefault = (data, ldDefaultKey, iptcDefaultKey) => data[ldDefaultKey];
const dcTypes = {
  Collection: 'Collection', Dataset: 'Document', Event: 'Event', Image: 'Image',
  InteractiveResource: 'Object', MovingImage: 'Video', PhysicalObject: 'Object',
  Service: 'Service', Software: 'Application', Sound: 'Audio', StillImage: 'Image',
  Text: 'Note', Person: 'Person', Organization: 'Organization'
};
const _metaProperties = {
  dc: {
    contributor:[], coverage:'', creator:[], date:[], description:'', format:'',
    identifier:'', language:[], publisher:[], relation:[], rights:'', source:'',
    subject:[], title:'', type:[]
  },
  tiff: {
    // https://developer.adobe.com/xmp/docs/XMPNamespaces/tiff/
    // stored elsewhere in XMP: Artist, Copyright, ImageDescription
    BitsPerSample:[], Compression:'', DateTime:'', ImageLength:0,
    ImageWidth:0, Make:'', Model:'', Orientation:'', PhotometricInterpretation:'',
    PlanarConfiguration:'', PrimaryChromaticities:[], ReferenceBlackWhite:[],
    ResolutionUnit:'', SamplesPerPixel:0, Software:'', TransferFunction:[],
    WhitePoint:[], XResolution:0, YResolution:0, YCbCrCoefficients:[],
    YCbCrPositioning:'', YCbCrSubSampling:[]

  },
  exif: {
    ApertureValue:0, BrightnessValue:0, CFAPattern:{}, ColorSpace:'',
    CompressedBitsPerPixel:0, Contrast:'', CustomRendered:'', DateTimeDigitized:'',
    DateTimeOriginal:'', DeviceSettingDescription: {}, DigitalZoomRatio:0,
    ExifVersion:'', ExifImageWidth:0, ExifImageHeight:0, ExposureBiasValue:0,
    ExposureCompensation:'', ExposureIndex:0, ExposureMode:'', ExposureProgram:'',
    ExposureTime:0, FileSource:'', Flash:{}, FlashEnergy:{}, FlashpixVersion:'',
    FocalLength:0, FocalLengthIn35mmFormat:0, FocalLengthIn35mmFilm:0, FNumber:0,
    FocalPlaneResolutionUnit:'', FocalPlaneXResolution:0, FocalPlaneYResolution:0,
    GainControl:'', GPSAltitude:0, GPSAltitudeRef:'', GPSAreaInformation:'',
    GPSDestBearing:0, GPSDestBearingRef:'', GPSDestDistance:0, GPSDestDistanceRef:'',
    GPSDestLatitude:'', GPSDestLongitude:'', GPSDifferential:'', GPSDOP:0,
    GPSImgDirection:0, GPSImgDirectionRef:'', GPSLatitudeRef:'', GPSLongitudeRef:'',
    GPSLatitude:[], GPSLongitude:[], GPSMapDatum:'', GPSMeasureMode:'',
    GPSProcessingMethod:'', GPSSatellites:'', GPSSpeed:0, GPSSpeedRef:'', GPSStatus:'',
    GPSTimeStamp:'', GPSTrack:0, GPSTrackRef:'', GPSVersionID:'', ImageUniqueID:'',
    ISO:0, ISOSpeedRatings:[], LightSource:'', MaxApertureValue:0, MeteringMode:'',
    OECF:{}, PixelXDimension:0, PixelYDimension:0, RelatedSoundFile:'', Saturation:'',
    SceneCaptureType:'', SceneType:'', SensingMethod:'', Sharpness:'', ShutterSpeedValue:0,
    SpatialFrequencyResponse:{}, SpectralSensitivity:'', SubjectArea:[], SubjectDistance:0,
    SubjectDistanceRange:'', SubjectLocation:[], WhiteBalance:''
  },
  photoshop: {
    ColorMode:9, DocumentAncestors:[], History:'', ICCProfile:'', TextLayers:[],
    AuthorsPosition: '', CaptionWriter:'', Category:'', City:'', Country:'',
    Credit:'', DateCreated:'', Headline:'', Instructions:'', Source:'', State:'',
    SupplementalCategories:[], TransmissionReference:'', Urgency:8
  },
  xmp: {
    CreateDate:'', CreatorTool:'', Identifier:[], Label:'', MetadataDate:'',
    ModifyDate:'', Rating:5, BaseURL:'', Nickname:'', Thumbnails:[]
  },
  xmpRights: {
    Certificate:'', Marked:true, Owner:[], UsageTerms:'', WebStatement:''
  },
  xmpMM: {
    DerivedFrom:'', DocumentID:'', InstanceID:'', OriginalDocumentID:'',
    RenditionClass:'', RenditionParams:''
  },
  Iptc4xmpCore: {
    Location:'', CountryCode:'', IntellectualGenre:'', SubjectCode:[], Scene:[]
  },
  Iptc4xmpExt: {
    PersonInImage:[]
  }
};
const _headerIdToLdPrefix = {
  ifd0: 'tiff',
  ifd1: 'ifd1',
  dc: 'dc',
  exif: 'exif',
  gps: 'exif',
  Iptc4xmpCore: 'Iptc4xmpCore',
  Iptc4xmpExt: 'Iptc4xmpExt',
  iptc: 'Iptc4xmpExt',
  photoshop: 'photoshop',
  tiff: 'tiff',
  xap: 'xmp',
  xmp: 'xmp',
  xapDM: 'xmpDM',
  xmpDM: 'xmpDM',
  xapMM: 'xmpMM',
  xmpMM: 'xmpMM',
  xapRights: 'xmpRights',
  xmpRights: 'xmpRights'
}

function blankLD (data, href, mediaType, name = '') {
  const dataLink = {
    type: ['Link'],
    href,
    mediaType,
    name
  };
  const ldo = { url: [dataLink], tag: [], result: [], context: [] };
  if (typeof data !== 'object') { return ldo }
  if (!!data.location) { ldo.location = data.location }
  const makeLoc = () => {
    if (!ldo.hasOwnProperty('location') || typeof ldo.location !== 'object' || !ldo.location ||
    Array.isArray(ldo.location)) {
      ldo.location = {type:['Place'], name: '', summary: ''}
    }
  }
  const hasLocKey = (k) => ldo.hasOwnProperty('location') && typeof ldo.location === 'object' &&
    !Array.isArray(ldo.location) && ldo.location.hasOwnProperty(k) &&
      typeof ldo.location[k] === 'number';
  const multilang = (k, v, result = {}) => {
    if (!v) { return [] }
    if (typeof v === 'string') {
      result[k] = v
    } else {
      result[`${k}Map`] = toArray(v).reduce((o, langO) => {
        if (langO.hasOwnProperty('lang') && langO.hasOwnProperty('value')) {
          o[langO.lang] = langO.value
        }
        return o
      }, {});
    }
    return [result]
  }

  ['gps', 'exif'].forEach((locVocab) => {
    const vocabO = data.hasOwnProperty(locVocab) ? data[locVocab] : null;
    if (!vocabO) { return }
    ['latitude', 'longitude', 'altitude', 'radius'].forEach((locKey) => {
      if (!hasLocKey(locKey)) {
        let value;
        if (vocabO.hasOwnProperty(locKey) && !!vocabO[locKey]) {
          value = typeof vocabO[locKey] === 'number' ?
            vocabO[locKey] : parseFloat(vocabO[locKey])
        }
        if (isValidNr(value)) {
          makeLoc();
          ldo.location[locKey] = value
        }
      }
    });
    if (!hasLocKey('altitude')) {
      if (vocabO.hasOwnProperty('GPSAltitude')) {
        if (typeof vocabO.GPSAltitude === 'string') {
          vocabO.GPSAltitude = parseInt(vocabO.GPSAltitude, 10)
        }
        if (isValidNr(vocabO.GPSAltitude)) {
          makeLoc();
          ldo.location.altitude = vocabO.hasOwnProperty('GPSAltitudeRef') &&
            (vocabO.GPSAltitudeRef === 0 || vocabO.GPSAltitudeRef === 'Below sea level') ?
              (0 - vocabO.GPSAltitude) : vocabO.GPSAltitude;
        }
      }
    }
  });
  if (hasLocKey('name')) { ldo.location.name = toArray(ldo.location.name) }
  if (hasLocKey('summary')) { ldo.location.summary = toArray(ldo.location.summary) }
  // Iptc4xmpCore:Location	Name of a location the content is focussing on -- normative main name for location 0
  if (data.hasOwnProperty('Iptc4xmpCore') && data.Iptc4xmpCore.hasOwnProperty('Location')) {
    makeLoc();
    if (!ldo.location.hasOwnProperty('name')) {
      ldo.location.name = toArray(data.Iptc4xmpCore.Location);
    } else if (!ldo.location.hasOwnProperty('summary')) {
      ldo.location.summary = toArray(data.Iptc4xmpCore.Location);
    } else {
      ldo.location.name = toArray(ldo.location.name).concat(toArray(data.Iptc4xmpCore.Location));
    }
  }
  // CountryCode is in Iptc4xmpCore, others should be in photoshop or iptc (legacy)
  let locationDetails = { City:'', State:'', Country:'', CountryCode:'' };
  ['Iptc4xmpCore', 'photoshop', 'iptc'].forEach((locVocab) => {
    const vocabO = data.hasOwnProperty(locVocab) ? data[locVocab] : null;
    if (!vocabO) { return }
    Object.keys(locationDetails).forEach((locKey) => {
      if (!locationDetails[locKey].length && vocabO.hasOwnProperty(locKey) && typeof vocabO[locKey] === 'string') {
        locationDetails[locKey] = vocabO[locKey]
      }
    })
  });
  if (Object.values(locationDetails).join('').length) {
    const {City = '', State = '', Country = '', CountryCode = ''} = locationDetails;
    const locationDetailsString = `in ${City}${!!City ? ', ' : ' '}${State}${!!State ? ', ' : ' '}`+
      `${Country}${!!CountryCode ? ' (' : ''}${CountryCode}${!!CountryCode ? ')' : ''}`;
    makeLoc();
    if (!ldo.location.hasOwnProperty('name') || !ldo.location.name.length) {
      ldo.location.name = toArray(locationDetailsString)
    } else if (!ldo.location.hasOwnProperty('summary') || !ldo.location.summary.length) {
      ldo.location.summary = toArray(locationDetailsString)
    } else {
      ldo.location.summary = toArray(ldo.location.summary).concat(toArray(locationDetailsString))
    }
  }
  if (!Array.isArray(ldo.location)) { ldo.location = [ldo.location] }
  // ['Iptc4xmpExt','PersonInImage','People']
  // ifd1 thumbnail to xmp Thumbnails
  /*
  const iptcCore1 = {Keywords: 'tag', EditStatus: 'result', FixtureIdentifier: 'context'};
  if (iptcCore1.hasOwnProperty(k)) {
    if (typeof v === 'string') {
      o[iptcCore1[k]] = {
        type: k === 'Keywords' ? ['Note'] : ['Object', `redaktor:${k}`],
        name: k === 'Keywords' ? v.split(',').map((s) => s.trim()) : v
      }
    } else if (k === 'Keywords' && Array.isArray(v)) {
      o[iptcCore1[k]] = v.map(toNameNote);
    }
    return o
  }
  */

  const functional = {
    mediaType:1, width:1, height:1, subject:1, startTime:1, endTime:1, duration:1,
    published:1, updated:1, accuracy:1, altitude:1, units:1, radius:1,
    latitude:1, longitude:1, href:1, hreflang:1
  }
  if (data.hasOwnProperty('as')) {
    for (let [key, value] of Object.entries(data.as)) {
      if (!ldo.hasOwnProperty(key)) {
        ldo[key] = value
      } else if (Array.isArray(value) || !functional.hasOwnProperty(key)) {
        ldo[key] = toArray(ldo[key]).concat(toArray(value))
      }
    }
  }
  return ldo
}

exports.metaProperties = _metaProperties;
exports.headerIdToLdPrefix = _headerIdToLdPrefix;

exports.getPrefixObject = function getPrefixObject(o, metaProperties = _metaProperties, headerIdToLdPrefix = _headerIdToLdPrefix) {
  if (typeof o !== 'object' || !o) { return o }
  for (let key of Object.keys(o)) {
    if (!headerIdToLdPrefix.hasOwnProperty(key)) { continue }
    const prefix = headerIdToLdPrefix[key];
    if (!metaProperties.hasOwnProperty(prefix)) { continue }
    if (key !== prefix) {
      Object.defineProperty(o, prefix,
          Object.getOwnPropertyDescriptor(o, key));
      delete o[key];
    }
  }
  return o
}

exports.urls = function (req, proxyRes) {
  const reqUrl = `${req.protocol||'https'}://${req.get('host')}${req.originalUrl}`;
  const proxyUrl = proxyRes.hasOwnProperty('socket') && proxyRes.socket.hasOwnProperty('_httpMessage') ?
    proxyRes.socket._httpMessage.path||reqUrl : reqUrl;
  return [reqUrl, proxyUrl];
}
exports.baseInfo = function (req, res, proxyRes, inputFallback, outputFallback) {
  const mediaType = (!res.get('content-type') ? inputFallback : res.get('content-type')).toLowerCase();
  const [mainType, subType] = mediaType.split('/');
  const [reqUrl, proxyUrl] = exports.urls(req, proxyRes);
  const acceptsJSON = !!req.accepts('application/json') || !!req.accepts('json');
  const isPlainJSONmeta = !req.accepts('application/ld+json') && acceptsJSON;
  return {mediaType, mainType, subType, reqUrl, proxyUrl, acceptsJSON, isPlainJSONmeta}
}

exports.getLD = function getLD(
  data, href, mediaType, name = '', metaProperties = _metaProperties, headerIdToLdPrefix = _headerIdToLdPrefix
) {
  data = exports.getPrefixObject(data);
  if (data.hasOwnProperty('as')) {
    data = {...data, ...data.as};
    delete data.as
  }
  const metaLD = {type: ['Image'], ...blankLD(data, href, mediaType, name)};
  // see https://developer.adobe.com/xmp/docs/XMPNamespaces/
  if (typeof data !== 'object') { return metaLD }
  const entries1 = Object.entries(data);
  for (let [vocab, ld] of entries1) {
    // TODO mediapro / people etc.: legacy needs to be handled before
    if (!metaProperties.hasOwnProperty(vocab)) { continue }
    const entries2 = Object.entries(ld);
    for (let [k, v] of entries2) {
      if (!metaProperties[vocab].hasOwnProperty(k)) { continue }
      const sample = metaProperties[vocab][k];
      const key = `${vocab}:${k}`;
      if (typeof v === 'object' && !Array.isArray(v) &&
        v.hasOwnProperty('lang') && v.lang === 'x-default' &&
        v.hasOwnProperty('value')
      ) {
        metaLD[key] = Array.isArray(sample) ? toArray(v.value) : v.value;
        continue
      }
      if (typeof sample === 'string') {
        metaLD[key] = `${v}`
      } else if (typeof sample === 'number') {
        const int = vocab === 'exif' ? parseFloat(v) : parseInt(v, 10);
        if (!!int && !isNaN(int) && int > (k === 'Rating' ? -1 : 0) && int <= sample) {
          metaLD[key] = int
        } else if (sample === 0 && !!int && !isNaN(int)) {
          metaLD[key] = int
        }
        continue
      } else if (Array.isArray(sample)) {
        metaLD[key] = toArray(v);
      } else if (Array.isArray(v)) {
        v = v[0]
      }
      if (typeof sample === typeof v || (v instanceof Date && typeof v.getMonth === 'function')) {
        metaLD[key] = v
      }
    }
  }
  // console.log(metaLD);

  const hasAnyProps = (...keys) => !!keys.map((prop) => metaLD.hasOwnProperty(prop)).filter((b) => !!b).length;
  const multilang = (k, v, result = {}) => {
    if (!v) { return [] }
    if (typeof v === 'string') {
      result[k] = v
    } else {
      result[`${k}Map`] = toArray(v).reduce((o, langO) => {
        if (langO.hasOwnProperty('lang') && langO.hasOwnProperty('value')) {
          o[langO.lang] = langO.value
        }
        return o
      }, {});
    }
    return [result]
  }
  /*
  "Iptc4xmpCore:IntellectualGenre":"Genre",
  Describes the nature, intellectual or journalistic characteristic of a news object, not specifically its content.

  Specifies one or more Subjects from the IPTC Subject-NewsCodes taxonomy to categorize the content.
  Each Subject is represented as a string of 8 digits in an unordered list.
  "Iptc4xmpCore:SubjectCode":[
     "Themencode1"
  ],

  Describes the scene of a photo content. Specifies one ore more terms from the IPTC Scene-NewsCodes.
  Each Scene is represented as a string of 6 digits in an unordered list.
  "Iptc4xmpCore:Scene":[
     "Szene1"
  ],
  */
  const [contexts, tags] = [new Set(), new Set()];
  const contextKeys = ['photoshop:TransmissionReference', 'Iptc4xmpCore:Scene'];
  const tagKeys = ['dc:subject', 'Iptc4xmpCore:SubjectCode', 'photoshop:Category', 'photoshop:SupplementalCategories'];
  if (hasAnyProps(...contextKeys)) {
    contextKeys.forEach((ldKey) => {
      if (!hasAnyProps(ldKey) || contexts.has(ldKey)) { return }
      contexts.add(ldKey);
      const [ldV = ''] = [metaLD[ldKey]];
      if (!!ldV) {
        metaLD.context = (toArray(metaLD.context)||[]).concat(toArray(ldV).map((name) =>
          ({ type: ['Object', `redaktor:${ldKey.split(':')[1]}`], name })))
      }
    })
  }
  if (hasAnyProps(...tagKeys)) {
    tagKeys.forEach((ldKey) => {
      if (!hasAnyProps(ldKey) || tags.has(ldKey)) { return }
      tags.add(ldKey);
      const [ldV = ''] = [metaLD[ldKey]];
      if (!!ldV) {
        metaLD.tag = (toArray(metaLD.tag)||[]).concat(toArray(ldV).map(toNameNote))
      }
    })
  }
  if (hasAnyProps('dc:creator', 'photoshop:Credit', 'photoshop:Source', 'dc:rights')) {
    if (!hasAnyProps('attributedTo')) { metaLD.attributedTo = { type: ['Group'] } }
    metaLD.attributedTo = { type: ['Group'], name: [], summary: [], ...(metaLD.attributedTo||{}) }
    const [
      creator = [], Credit = '', Source = '', right = '', usage = '', webStatement = '',
      headline = '', genre = '', subject = '', description = ''
    ] = [
      toArray(metaLD['dc:creator']), metaLD['photoshop:Credit'], metaLD['photoshop:Source'],
      metaLD['dc:rights'], metaLD['xmpRights:UsageTerms'], metaLD['xmpRights:WebStatement'],
      metaLD['photoshop:Headline'], metaLD['Iptc4xmpCore:IntellectualGenre'],
      metaLD['dc:subject'], metaLD['dc:description']
      /*
      dc:contributor
      photoshop:CaptionWriter
      xmpRights:Owner []
      xmpDM:artist
      xmpDM:director
      xmpDM:directorPhotography
      xmpDM:engineer
      xmpDM:composer
      xmpDM:client
      */

      /*
      xmpDM:instrument
      xmpDM:duration Time
      xmpDM:audioChannelType	The audio channel type. One of:Mono,Stereo,5.1,7.1,16 Channel,Other
      xmpDM:audioSampleRate Int
      xmpDM:videoFrameRate TEXT 24, NTSC, PAL or INT as TEXT
      xmpDM:videoFrameSize	The frame size. For example: w:720, h: 480, unit:pixels
      */
    ];

    if (!!creator.length) {
      metaLD.attributedTo.name = (toArray(metaLD.attributedTo.name)||[]).concat(toArray(creator))
    }
    if (!metaLD.attributedTo.hasOwnProperty('name') && (!!Credit || !!Source)) {
      metaLD.attributedTo.name = `${Credit}${!!Credit && !!Source ? ' / ' : ''}${Source}`
    } else if (!!Credit || !!Source) {
      metaLD.attributedTo.summary = (toArray(metaLD.attributedTo.summary)||[]).concat(
        toArray(`${Credit}${!!Credit && !!Source ? ' / ' : ''}${Source}`)
      );
    }

    [right, usage].forEach((v) => {
      if (!!v) {
        const values = (multilang('content', v)||[]).map((r) => r.content);
        metaLD.attributedTo.content = (toArray(metaLD.attributedTo.content)||[]).concat(values)
      }
    });
    [headline, genre].forEach((v) => {
      if (!!v) {
        const values = (multilang('name', v)||[]).map((r) => r.name);
        metaLD.name = (toArray(metaLD.name)||[]).concat(values).filter((v) => !!v)
      }
    });
    if (!!subject) {
      const values = (multilang('summary', subject)||[]).map((r) => r.summary);
      metaLD.subject = (toArray(metaLD.subject)||[]).concat(values).filter((v) => !!v)
    }
    if (!!description) {
      const values = (multilang('content', description)||[]).map((r) => r.content);
      if (!metaLD.subject) {
        metaLD.subject = values
      } else {
        metaLD.content = (toArray(metaLD.content)||[]).concat(values).filter((v) => !!v)
      }
    }
  }
  // TODO name = Make Model
  const metaResult = {};
  const instrument = {type: ['Object']};
  const entries = Object.entries(metaLD);
  for (let [k, v] of entries) {
    const [vocab, key] = k.split(':');
    if (vocab === 'exif' || vocab === 'tiff') {
      instrument[k] = v;
    } else {
      metaResult[k] = v;
    }
  }
  if (Object.keys(instrument).length > 1) { metaResult.instrument = instrument }
  return metaResult;
/*
data = {type: ['Image'], tag: [], result: [], context: [], ...data};
type
---

https://developer.adobe.com/xmp/docs/XMPNamespaces/XMPDataTypes/ContactInfo/
---
url
published | updated
if (v instanceof Date && typeof v.getMonth === 'function' && typeof sample === 'string') {
  o[key] = v.toISOString()
}

icon
preview
generator

attachment
duration
current | first | last | items | next | prev | partOf | endTime | startTime | startIndex |
totalItems | relationship | describes | formerType | deleted

'photoshop:Urgency': 1,
'xmp:Rating': 2,
'photoshop:Instructions': 'Anweisungen',
'photoshop:TransmissionReference': 'jobjennung',
*/
}
