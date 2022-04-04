'use strict';
import { trackTypes } from '../ebml/trackTypes.js';
import {
  readChars,
  findMarker,
  findMarkers,
  strToUint8Array,
  getInt16,
  getInt32,
  getUInt16,
  getUInt32,
  getFixedPoint16,
  getFixedPoint32
} from './binary.mjs';

// https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#/
//    /apple_ref/doc/uid/TP40000939-CH204-25642
// https://github.com/nadr0/mp4-metadata/blob/master/source/index.js

const intToDate = (integer) => {
  if (!integer) { return null }
  // moov atom time is in seconds since midnight, January 1, 1904,
  // so we have to subtract the difference between Epoch time,
  // and multiply by 1000 to get it in milliseconds for js Date
  return new Date(((integer - 2082844800) * 1000));
}
const iterate = (buffer, offset=0) => {
  return {
    next(bytes, remain=false) {
      if (offset >= buffer.byteLength) { return null }
      const slice = buffer.slice(offset, offset + bytes);
      if (!remain) {
        offset += bytes;
      }
      return slice;
    },
    rest() {
      const slice = buffer.slice(offset);
      offset = buffer.byteLength;
      return slice;
    }
  }
}
const getFtyp = (atom) => {
  if (!atom || !atom.byteLength) { return {} }
  const iterator = iterate(atom, 8);
  const ftyp = new TextDecoder().decode(iterator.next(4)).trim();
  const minorVersionBCD = iterator.next(4);
  const minorVersionCentury = minorVersionBCD[0].toString(16).padStart(2, '0');
  const minorVersionYear = minorVersionBCD[1].toString(16).padStart(2, '0');
  const minorVersionMonth = minorVersionBCD[2].toString(16).padStart(2, '0');
  const minorVersion = `${minorVersionMonth} ${minorVersionCentury}${minorVersionYear}`;
  const compatibleBrands = [];
  const compatibleBrandsIterator = iterate(iterator.rest());
  const placeholderEntry = '00000000';
  while (compatibleBrandsIterator.next(4, true)) {
    const compatibleBrand = compatibleBrandsIterator.next(4);
    if (compatibleBrand.toString('hex') !== placeholderEntry) {
      compatibleBrands.push(new TextDecoder().decode(compatibleBrand).trim());
    }
  }
  return { ftyp, minorVersion, compatibleBrands };
}

const getAtomByType = (data, atom) => {
  const pos = findMarker(data, atom);
  if (!pos) {
      return null;
  }
  const startPosition = pos - 4;
  const size = getUInt32(data, startPosition);
  return data.slice(startPosition, startPosition + size);
}

const _movieAtom = (data, position) => {
  const size = getUInt32(data, position);
  return data.slice(position, position + size);
}
const getMovieAtom = (data) => {
  const searchFirstKB = 32 * 1000;
  const moovMarker = strToUint8Array('moov');
  const needle = moovMarker.toString();
  // Search the first x KB of file, in case the moov atom has been placed there.
  for (let i = 0; i < searchFirstKB; i++) {
    if ((data.slice(i, i + 4)).toString() === needle) {
      return _movieAtom(data, i - 4);
    }
  }
  // Search entire file backwards, the moov atom often resides at the end of file.
  // TODO mov faststart, move atom to start
  for (let i = data.length; i >= 0; i--) {
    if ((data.slice(i, i + 4)).toString() === needle) {
      return _movieAtom(data, i - 4);
    }
  }
}
const getFtypAtom = (data) => {
  return getAtomByType(data, 'ftyp')
}
const parseHandlerReferenceAtom = (mediaAtom) => {
  const hdlr = getAtomByType(mediaAtom, 'hdlr');
  return !hdlr ? null : {
    size: getUInt32(hdlr),
    type: readChars(hdlr),
    version: hdlr[8],
    flags: hdlr.slice(9, 12),
    componentType: readChars(hdlr, 12, 4),
    componentSubType: readChars(hdlr, 16, 4),
    componentManufacturer: hdlr.slice(20, 24),
    componentFlags: hdlr.slice(24, 28),
    componentFlagsMask: hdlr.slice(28, 32),
    componentName: readChars(hdlr, 32, (getUInt32(hdlr, 0) - 32)),
  };
};

const parseLang = (arr) => {
  const bit16 = getUInt16(arr);
  const char1 = ((bit16 & 0xffe0) >> 10) + 0x60;
  const char2 = ((bit16 & 0x03e0) >> 5) + 0x60;
  const char3 = ((bit16 & 0x001f)) + 0x60;
  return [char1, char2, char3].map((entry) => String.fromCodePoint(entry)).join('');
};
const parseMediaHeader = (mediaAtom) => {
  const mdhd = getAtomByType(mediaAtom, 'mdhd');
  return !mdhd ? null : {
    size: getUInt32(mdhd),
    type: readChars(mdhd),
    version: mdhd[8],
    flags: mdhd.slice(9, 12),
    creationTime: intToDate(getUInt32(mdhd, 12)),
    modificationTime: intToDate(getUInt32(mdhd, 16)),
    timeScale: getUInt32(mdhd, 20),
    duration: getUInt32(mdhd, 24),
    language: parseLang(mdhd.slice(28, 30)), // readChars(mdhd, 28, 2),
    quality: getUInt16(mdhd, 30),
  };
};

const parseSoundMediaInfoHeaderAtoms = (mediaInfoAtom) => {
  const smhd = getAtomByType(mediaInfoAtom, 'smhd');
  return !smhd ? null : {
    size: getUInt32(smhd),
    type: readChars(smhd),
    version: smhd[8],
    flags: smhd.slice(9, 12),
    balance: getUInt16(smhd,12),
    reserved: smhd.slice(14),
  };
};

const parseGeneralStructureOfASampleDesc = (data, numberOfEntries) => {
  const entries = [];
  for (let i = 0; i < numberOfEntries; i++) {
    const size = getUInt32(data);
    const dataFormat = readChars(data);
    entries.push({
      size,
      dataFormat,
      reserved: data.slice(8, 14),
      dataReferenceIndex: getUInt16(data, 14),
      ...parseVideoSampleDesc(data.slice(16, size), dataFormat),
      ...parseSoundSampleDesc(data.slice(16, size), dataFormat, size),
    });
    data = data.slice(size);
  }
  return entries;
};

const parseSoundSampleDesc = (data, type) => {
  const availableTables = [
    'NONE', 'raw ', 'twos', 'sowt', 'cvid', 'MAC3', 'MAC6',
    'ima4', 'fl32', 'fl64', 'in24', 'in32', 'ulaw', 'alaw',
    'dvca', 'QDMC', 'QDM2', 'Qclp', '.mp3', 'mp4a', 'ac-3',
  ];
  if (!availableTables.includes(type)) {
    return null;
  }

  const version = getInt16(data);
  let sampleDesc = {
    version,
    revisionLevel: getInt16(data, 2),
    vendor: getInt32(data, 4),
  };

  if (version === 0) {
    sampleDesc = {
      ...sampleDesc,
      numberOfChannels: getInt16(data, 8),
      sampleSize: getInt16(data, 10),
      compressionId: getInt16(data, 12),
      packetSize: getInt16(data, 14),
      sampleRate: getFixedPoint32(data, 16),
      extensions: parseSoundSampleDescExtensions(data.slice(20)),
    };
  } else if (version === 1) {
    sampleDesc = {
      ...sampleDesc,
      numberOfChannels: getInt16(data, 8),
      sampleSize: getInt16(data, 10),
      compressionId: getInt16(data, 12),
      packetSize: getInt16(data, 14),
      sampleRate: getFixedPoint32(data, 16),
      samplesPerPacket: getUInt32(data, 20),
      bytesPerPacket: getUInt32(data, 24),
      bytesPerFrame: getUInt32(data, 28),
      bytesPerSample: getUInt32(data, 32),
      extensions: parseSoundSampleDescExtensions(data.slice(36)),
    };
  } else if (version === 2) {
    // ToDo: implement version 2
  }

  return sampleDesc;
};

const parseVideoSampleDesc = (data, type) => {
  const availableTables = [
    'cvid', 'jpg', 'smc ', 'rle ', 'rpza', 'kpcd',
    'png ', 'mjpa', 'mjpb', 'SVQ1', 'SVQ3', 'mp4v',
    'avc1', 'dvc ', 'dvcp', 'gif ', 'h263', 'tiff',
    'raw ', '2vuY', 'yuv2', 'v308', 'v408', 'v216',
    'v410', 'v210'
  ];
  if (!availableTables.includes(type)) {
    return null;
  }
  const vendor = getInt32(data, 4);
  return {
    version: getInt16(data),
    revisionLevel: getInt16(data, 2),
    vendor: vendor !== 0 ? readChars(data) : vendor,
    temporalQuality: getInt32(data, 8),
    spatialQuality: getInt32(data, 12),
    width: getInt16(data, 16),
    height: getInt16(data, 18),
    horizontalResolution: getFixedPoint32(data, 20),
    verticalResolution: getFixedPoint32(data, 24),
    dataSize: getInt32(data, 28),
    frameCount: getInt16(data, 32),
    compressorName: readChars(data, 35, data[34]),
    depth: getInt16(data, 66),
    colorTableID: getInt16(data, 68),
    extensions: parseVideoSampleDescExtensions(data.slice(70)),
  }
};

const dFn = (data) => data;
const availableVideoSampleDescTypes = {
  gama: dFn,
  fiel: dFn,
  mjqt: dFn,
  mjht: dFn,
  esds: dFn,
  // avcC: contains AVCDecoderConfigurationRecord
  avcC: dFn,
  pasp: (data) => {
    return {
      size: data.size,
      type: data.type,
      hSpacing: getUInt32(data.data, 0),
      vSpacing: getUInt32(data.data, 4),
    }
  },
  colr: (data) => {
    return {
      size: data.size,
      type: data.type,
      colorParameterType: readChars(data.data, 0, 4),
      primariesIndex: getUInt16(data.data, 4),
      transferFunctionIndex: getUInt16(data.data, 6),
      matrixIndex: getUInt16(data.data, 8),
    }
  },
  clap: dFn,
}

const parseSampleDescExtensions = (data, extensionTypes, tables = []) => {
  const size = getUInt32(data);
  tables.push({
    size,
    type: readChars(data),
    data: data.slice(8, size),
  });
  if (size && size < data.length) {
    return parseSampleDescExtensions(data.slice(size), extensionTypes, tables);
  } else {
    return tables
      .filter(entry => Object.keys(extensionTypes).includes(entry.type))
      .map(entry => extensionTypes[entry.type](entry));
  }
};

const parseVideoSampleDescExtensions = (data) => {
  return parseSampleDescExtensions(data, availableVideoSampleDescTypes);
};

const availableSoundSampleDescTypes = {
  0: dFn,
  wave: (data) => {
    return {
      size: data.size,
      type: data.type,
      extensions: parseSoundSampleDescExtensions(data.data),
    }
  },
  frma: dFn,
  esds: (data) => {
    return {
      size: data.size,
      type: data.type,
      version: getUInt32(data.data),
      elementaryStreamDescriptor: data.data.slice(4),
    }
  },
  chan: dFn,
  folw: dFn,
}

const parseSoundSampleDescExtensions = (data) => {
  return parseSampleDescExtensions(data, availableSoundSampleDescTypes);
};


const parseSampleTableAtom = (data) => {
  const stbl = getAtomByType(data, 'stbl');
  return {
    size: getUInt32(stbl),
    type: readChars(stbl),
    stsd: parseSampleDescAtom(stbl.slice(8)),
  };
};

const parseSampleDescAtom = (data) => {
  const stsd = getAtomByType(data, 'stsd');
  const size = getUInt32(stsd);
  const numberOfEntries = getUInt32(stsd, 12);
  return {
    size,
    type: readChars(stsd),
    version: stsd[8],
    flags: stsd.slice(9, 12),
    numberOfEntries,
    sampleDescriptionTable: parseGeneralStructureOfASampleDesc(stsd.slice(16), numberOfEntries),
  };
};

const parseMediaInfoAtom = (mediaAtom, subtype) => {
  const minf = getAtomByType(mediaAtom, 'minf');
  if (!minf) {
    return null;
  }
  const data = {
    size: getUInt32(minf),
    type: readChars(minf),
    hdlr: parseHandlerReferenceAtom(minf),
    dinf: parseDataInfoAtom(minf),
    stbl: parseSampleTableAtom(minf),
  }
  switch (subtype) {
    case 'vide': break;
    case 'soun':
      data.smhd = parseSoundMediaInfoHeaderAtoms(minf);
      break;
    default: break;
  }
  return data;
}

const parseDataReferenceAtoms = (data, entriesLength) => {
  const payload = [];
  let ref = data;
  for(let i = 0; i < entriesLength; i++) {
    const size = getUInt32(ref);
    payload.push({
      size: size,
      type: readChars(ref),
      version: ref[8],
      flags: ref.slice(9, 12),
      data: ref.slice(12, size),
    });
    ref = ref.slice(size);
  }
  return payload;
};

const parseDataInfoAtom = (mediaAtom) => {
  const dinf = getAtomByType(mediaAtom, 'dinf');
  if (!dinf) {
    return null;
  }
  const numberOfEntries = getUInt32(dinf, 20);
  return {
    size: getUInt32(dinf),
    type: readChars(dinf),
    dref: {
      size: getUInt32(dinf, 8),
      type: readChars(dinf, 12, 4),
      version: dinf[16],
      flags: dinf.slice(17, 20),
      numberOfEntries: numberOfEntries,
      dataReferences: parseDataReferenceAtoms(dinf.slice(24), numberOfEntries),
    }
  };
};

const parseMediaAtom = (trakAtom) => {
  const mdia = getAtomByType(trakAtom, 'mdia');
  if (!mdia) {
    return null;
  }

  const size = getUInt32(mdia);
  const type = readChars(mdia);
  const mdhd = parseMediaHeader(mdia);
  const hdlr = parseHandlerReferenceAtom(mdia);

  return !mdia ? null : {
      size: size,
      type: type,
      mdhd: mdhd,
      hdlr: hdlr,
      minf: parseMediaInfoAtom(mdia, hdlr.componentSubType)
  };
};

const getMovie = (moovAtom) => {
  const mvhd = getAtomByType(moovAtom, 'mvhd');
  return !mvhd ? null : {
    size: getUInt32(mvhd),
    type: readChars(mvhd),
    version: mvhd[8],
    flags: 0,
    creationTime: intToDate(getUInt32(mvhd, 12)),
    modificationTime: intToDate(getUInt32(mvhd, 16)),
    timeScale: getUInt32(mvhd, 20),
    duration: getUInt32(mvhd, 24),
    preferredRate: getFixedPoint32(mvhd, 28),
    preferredVolume: getFixedPoint16(mvhd, 32),
    reserved: 0,
    matrixStructure: mvhd.slice(40, 44),
    previewTime: getUInt32(mvhd, 80),
    previewDuration: getUInt32(mvhd, 84),
    posterTime: getUInt32(mvhd, 88),
    selectionTime: getUInt32(mvhd, 92),
    selectionDuration: getUInt32(mvhd, 96),
    currentTime: getUInt32(mvhd, 100),
    nextTrackID: getUInt32(mvhd, 104),
  };
};

const parseTrackHeader = (trakAtom) => {
  const tkhd = getAtomByType(trakAtom, 'tkhd');
  return !tkhd ? null : {
    size: getUInt32(tkhd),
    type: readChars(tkhd),
    version: tkhd[8],
    flags: tkhd.slice(9, 12),
    creationTime: intToDate(getUInt32(tkhd, 12)),
    modificationTime: intToDate(getUInt32(tkhd, 16)),
    id: getUInt32(tkhd, 20),
    duration: getUInt32(tkhd, 28),
    layer: getUInt16(tkhd, 40),
    alternateGroup: getUInt16(tkhd, 42),
    volume: getFixedPoint16(tkhd, 44),
    matrixStructure: tkhd.slice(48, 84),
    width: getFixedPoint32(tkhd, 84),
    height: getFixedPoint32(tkhd, 88),
  };
}

// trackTypes
const mp4CodeToTrackType = {
  vide: 'Video', soun: 'Audio', subt: 'Subtitle', meta: 'Meta', hint: 'Hint',
  auxv: 'AuxVideo', pict: 'Logo', tmcd: 'Timecode'
}
const parseTrackAtom = (trakAtom) => {
  let type = readChars(trakAtom);
  let typeSummary = trackTypes.Hint[1];
  const media = parseMediaAtom(trakAtom);
  if (media.hasOwnProperty('hdlr')) {

    if (media.hdlr.hasOwnProperty('componentSubType') && mp4CodeToTrackType.hasOwnProperty(media.hdlr.componentSubType)) {
      type = mp4CodeToTrackType[media.hdlr.componentSubType];
      typeSummary = trackTypes[type][0];
    } else if (media.hdlr.hasOwnProperty('componentType') && mp4CodeToTrackType.hasOwnProperty(media.hdlr.componentType)) {
      type = mp4CodeToTrackType[media.hdlr.componentType];
      typeSummary = trackTypes[type][0];
    }
  }

  return {
    size: getUInt32(trakAtom),
    type,
    typeSummary,
    header: parseTrackHeader(trakAtom),
    media
  };
};

const getTracks = (moovAtom) => {
  return findMarkers(moovAtom, 'trak').map((track) => {
    const position = track - 4;
    const size = getUInt32(moovAtom, position);
    return parseTrackAtom(moovAtom.slice(position, position + size));
  });
};

const TAGS = {
  '©alb':'','©ART':'','aART':'','©day':'','©nam':'','©gen':'','gnre':'','trkn':1,
  '©wrt':'','©too':'','©enc':'','cprt':'','©grp':'','keyw':'','©lyr':'','©cmt':'',
  'tmpo':1,'cpil':1,'disk':1,'tvsn':1,'tves':1,'tvsh':'','tven':'','tvnn':'',
  'desc':'','ldes':'','purd':'','purl':'','pgap':1,'pcst':1,'catg':'','rtng':1,
  'stik':1,'covr':''
};
const TYPES = {
 '0': 'uint8',
 '1': 'text',
 '13': 'jpg',
 '14': 'png',
 '21': 'int',
 '22': 'uint'
};
const getTags = (moovAtom) => {
  const udtaAtom = getAtomByType(moovAtom, 'udta');
  if (!udtaAtom) { return {} }
  const metaAtom = getAtomByType(udtaAtom, 'meta');
  if (!metaAtom) { return {} }
  const ilstAtom = getAtomByType(metaAtom, 'ilst');
  if (!ilstAtom) { return {} }
  return Object.keys(TAGS).reduce((o, key) => {
    try {
      const atom = getAtomByType(ilstAtom, key);
      const atomSize = !!atom ? getUInt32(atom) : 0;
      if (!!atomSize) {
        const METADATA_HEADER = 16;
        const atomName = readChars(atom);
        const typeInt = getUInt32(atom,16);
        const type = TYPES[typeInt];
        const extension = type === 'jpg' || type === 'png' ? type : 'txt';
        if (atomName === 'covr' && type === 'uint8') {
          type = 'jpg';
        }
        if (!!type) {
          const dataStart = METADATA_HEADER + 4 + 4;
          const dataLength = atomSize - dataStart;
          if (dataLength <= 0) { return o }
          const getByte = (v) => v;
          const getSByte = (v) => v > 127 ? v - 256 : v;
          const readInt = (intReader) => {
            const v = intReader.call(atom, dataStart + (dataLength === 8 ? 4 : 0));
            return v === null ? 0 : v;
          }
          switch (type) {
            case 'uint8':
              o[key] = getUInt32(atom, dataStart);
              break;
            case 'int':
              o[key] = readInt(dataLength === 1 ? getSByte : (dataLength === 2 ? getInt16 :
                (dataLength === 4 ? getInt32 : getUInt32)
              ));
              break;
            case 'uint':
              o[key] = readInt(dataLength === 1 ? getByte : (dataLength === 2 ? getUInt16 : getUInt32));
              break;
            case 'jpg':
            case 'png':
              o[key] = { extension, data: atom.slice(dataStart, atomSize) };
              break;

            default:
              o[key] = new TextDecoder().decode(atom.slice(dataStart, atomSize))
          }
        }
      }
    } catch(e) { console.log('error',e )}
    return o
  }, {});
}
export const mp4ToLD = { /* [ldVocab, ldKey, asKey?, asExtraType?] */
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
  cprt:   ['dc', 'rights', 'attributedTo', 'Copyright'],
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
export const getMeta = (file) => {
  file = new Uint8Array(file.hasOwnProperty('buffer') ? file.buffer : file);
  if (file.constructor !== Uint8Array) { return {} }
  const moovAtom = getMovieAtom(file);
  const ftypAtom = getFtypAtom(file);
  const baseInfo = {
    ftyp: readChars(file, 8, 4).trim(),
    version: getUInt32(file, 12),
    hasAudio: false,
    hasVideo: false,
    compatibleBrands: [],
    ...getFtyp(ftypAtom)
  }
  // Hint to JS that it can discard the whole file
  file = null;
  if (!moovAtom) { return baseInfo }
  const movie = getMovie(moovAtom);
  const tracks = getTracks(moovAtom);
  const tags = getTags(moovAtom);

  if (!!tracks.length) {
    if (!ftypAtom && baseInfo.ftyp !== 'qt' && baseInfo.ftyp !== 'mp4') {
      // might be legacy mov
      if (!!tracks.filter((track) => track.hasOwnProperty('media') &&
      track.media.hasOwnProperty('hdlr') && track.media.hdlr.hasOwnProperty('componentName') &&
      track.media.hdlr.componentName.indexOf('Apple') > -1).length) {
        baseInfo.ftyp = 'qt';
      }
    }
    baseInfo.hasAudio = !!tracks.filter((track) => track.type === 'Audio').length;
    baseInfo.hasVideo = !!tracks.filter((track) => track.type === 'Video').length;
  }

  if (!!movie && !!movie.duration) {
    baseInfo.duration = movie.duration;
  }
  if (!!tracks.length) {
    let [width, height] = [0, 0];
    tracks.forEach((t) => {
      if (t.hasOwnProperty('header')) {
        if (t.header.hasOwnProperty('width') && typeof t.header.width === 'number' &&
        !!t.header.width && t.header.width > width) {
          width = t.header.width;
        }
        if (t.header.hasOwnProperty('height') && typeof t.header.height === 'number' &&
        !!t.header.height && t.header.height > height) {
          height = t.header.height;
        }
      }
    });
    if (!!width && !!height) {
      baseInfo.width = width;
      baseInfo.height = height;
    }
  }

  return {
    type: 'MP4',
    ...baseInfo,
    movie,
    tags,
    tracks
  };
};
