/* https://github.com/arnellebalane/qtff-parser :

The MIT License (MIT)

Copyright (c) 2017 Arnelle Balane

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/* extended by XMP in the udta atom */

const fs = require('fs');
const path = require('path');
const util = require('util');
const xmp = require('./xmp');
const EPOCH = "1904-01-01T00:00:00Z";
const VIDEO_PATH = process.argv[2] || path.resolve(__dirname, '../data/movXmp2.mov');
const SIZE_BYTES = 4;
const TYPE_BYTES = 4;
const EXTENDED_SIZE_BYTES = 8;

let ExifMetadataType;
(function (ExifMetadataType) {
    ExifMetadataType["Image"] = "image";
    ExifMetadataType["Gps"] = "gps";
    ExifMetadataType["Interoperability"] = "interoperability";
    ExifMetadataType["Exif"] = "exif";
    ExifMetadataType["Thumbnail"] = "thumbnail";
})(ExifMetadataType = exports.ExifMetadataType || (exports.ExifMetadataType = {}));
/**
 * Describes the orientation of the image with two sides. The first side is
 * the side represented by the zeroth row. The second side is the side
 * represented by the zeroth column.
 */
let Orientation;
(function (Orientation) {
    Orientation[Orientation["TopLeft"] = 1] = "TopLeft";
    Orientation[Orientation["TopRight"] = 2] = "TopRight";
    Orientation[Orientation["BottomRight"] = 3] = "BottomRight";
    Orientation[Orientation["BottomLeft"] = 4] = "BottomLeft";
    Orientation[Orientation["LeftTop"] = 5] = "LeftTop";
    Orientation[Orientation["RightTop"] = 6] = "RightTop";
    Orientation[Orientation["RightBottom"] = 7] = "RightBottom";
    Orientation[Orientation["LeftBottom"] = 8] = "LeftBottom";
})(Orientation = exports.Orientation || (exports.Orientation = {}));
const __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const moment_1 = __importDefault(require("moment"));
const atomParsersMap = {
    ftyp: parseFtyp,
    free: parseFreeSkip,
    skip: parseFreeSkip,
    moov: parseMoov,
    mvhd: parseMvhd,
    trak: parseTrak,
    tkhd: parseTkhd,
    tapt: parseTapt,
    clef: parseTaptLeaf,
    prof: parseTaptLeaf,
    enof: parseTaptLeaf,
    edts: parseEdts,
    elst: parseElst,
    mdia: parseMdia,
    mdhd: parseMdhd,
    hdlr: parseHdlr,
    minf: parseMinf,
    vmhd: parseVmhd,
    smhd: parseSmhd,
    dinf: parseDinf,
    dref: parseDref,
    stbl: parseStbl,
    stsd: parseStsd,
    udta: parseUdta,
    AllF: parseAllF,
    SelO: parseSelO,
    WLOC: parseWloc,
    avc1: parseAvc1,
    avcC: parseAvcC,
    colr: parseColr,
    XMP_: parseXMP
};

fs.readFile(VIDEO_PATH, (err, data) => {
    const atoms = parseAtoms(getAtoms(data));
    console.log(util.inspect(atoms, { depth: null, colors: true }));
});

function iterate(buffer, offset=0) {
    return {
        next(bytes, remain=false) {
            if (offset >= buffer.byteLength) return null;

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
    };
}


function readFixedPointBuffer(buffer, whole=buffer.byteLength / 2, fraction=whole) {
    return buffer.readUIntBE(0, whole + fraction) >> (8 * fraction);
}

function getAtoms(buffer, offset=0) {
    const atoms = [];
    while (true) {
        const size = getAtomSize(buffer, offset);
        const atom = getAtom(buffer, offset, size);
        atoms.push(atom);

        offset += size;
        if (!size || offset >= buffer.byteLength) break;
    }

    return atoms;
}

function getAtom(buffer, offset, size) {
    if (size === 0) {
        return buffer.slice(offset);
    }
    return buffer.slice(offset, offset + size);
}

function getAtomSize(buffer, offset=0) {
    // console.log(buffer, offset);
    const size = buffer.readUInt32BE(offset);
    if (size !== 1) return size;

    // NOTE: I believe this will cause an error, since `byteLength` argument
    // should be at most `6`.
    const extendedSize = buffer.readUIntBE(offset + TYPE_BYTES, EXTENDED_SIZE_BYTES);
    return extendedSize;
}

function parseAtoms(atoms) {
    return atoms.map(atom => {
        const size = atom.readUInt32BE(0);
        const type = atom.slice(SIZE_BYTES, SIZE_BYTES + TYPE_BYTES).toString('ascii');
        const data = type in atomParsersMap ? atomParsersMap[type](atom) : null;
        const parsed = { size, type, data: size ? data : Array.from(atom) };
        Object.defineProperty(parsed, 'buffer', {
            value: atom,
            enumerable: false,
            writable: false
        });
        return parsed;
    });
}

function parseFtyp(atom) {
    const iterator = iterate(atom, 8);
    const majorBrand = iterator.next(4).toString('ascii');

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
            compatibleBrands.push(compatibleBrand.toString('ascii'));
        }
    }

    return { majorBrand, minorVersion, compatibleBrands };
}

function parseFreeSkip(atom) {
    const atomSize = getAtomSize(atom);
    return { freeSpace: atomSize - 8 };
}

function parseMoov(atom) {
    return parseAtoms(getAtoms(atom, 8));
}

function parseXMP(atom) {
  return xmp.parse(atom);
}

function parseMvhd(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const created = iterator.next(4).readUInt32BE(0);
    const modified = iterator.next(4).readUInt32BE(0);
    const timeScale = iterator.next(4).readUInt32BE(0);
    const duration = iterator.next(4).readUInt32BE(0);
    const preferredRate = readFixedPointBuffer(iterator.next(4));
    const preferredVolume = readFixedPointBuffer(iterator.next(2));
    const reserved = Array.from(iterator.next(10));
    const matrix = iterator.next(36);
    const previewTime = iterator.next(4).readUInt32BE(0);
    const previewDuration = iterator.next(4).readUInt32BE(0);
    const posterTime = iterator.next(4).readUInt32BE(0);
    const selectionTime = iterator.next(4).readUInt32BE(0);
    const selectionDuration = iterator.next(4).readUInt32BE(0);
    const currentTime = iterator.next(4).readUInt32BE(0);
    const nextTrackId = iterator.next(4).readUInt32BE(0);

    return {
        version, flags, created, modified, timeScale, duration,
        preferredRate, preferredVolume, previewTime, previewDuration, posterTime,
        selectionTime, selectionDuration, currentTime, nextTrackId
    };
}

function parseTrak(atom) {
    return parseAtoms(getAtoms(atom, 8));
}
const ORIENTATION_MAP = [
    { orientation: Orientation.TopLeft, matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    { orientation: Orientation.TopRight, matrix: [-1, 0, 0, 0, 1, 0, 0, 0, 1] },
    { orientation: Orientation.BottomLeft, matrix: [1, 0, 0, 0, -1, 0, 0, 0, 1] },
    { orientation: Orientation.BottomRight, matrix: [-1, 0, 0, 0, -1, 0, 0, 0, 1] },
    { orientation: Orientation.LeftTop, matrix: [0, 1, 0, 1, 0, 0, 0, 0, 1] },
    { orientation: Orientation.LeftBottom, matrix: [0, -1, 0, 1, 0, 0, 0, 0, 1] },
    { orientation: Orientation.RightTop, matrix: [0, 1, 0, -1, 0, 0, 0, 0, 1] },
    { orientation: Orientation.RightBottom, matrix: [0, -1, 0, -1, 0, 0, 0, 0, 1] },
];
function equals(a, b) {
    for (let i = 0; i < 9; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
function findOrientation(found) {
    for (let { orientation, matrix } of ORIENTATION_MAP) {
        if (equals(matrix, found)) {
            return orientation;
        }
    }
    return undefined;
}
function parseTkhd(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const created = iterator.next(4).readUInt32BE(0);
    const modified = iterator.next(4).readUInt32BE(0);
    const trackId = iterator.next(4).readUInt32BE(0);
    iterator.next(4);  // Reserved by Apple
    const duration = iterator.next(4).readUInt32BE(0);
    iterator.next(8);  // Reserved by Apple
    const layer = iterator.next(2).readUInt16BE(0);
    const alternateGroup = iterator.next(2).readUInt16BE(0);
    const volume = readFixedPointBuffer(iterator.next(2));
    iterator.next(2);  // Reserved by Apple
    const matrix = iterator.next(36);
    const width = readFixedPointBuffer(iterator.next(4));
    const height = readFixedPointBuffer(iterator.next(4));
    return {
        version, flags, width, height, trackId, layer, alternateGroup, volume, duration,
        created: moment_1.default(EPOCH).add(created, "seconds").toISOString(),
        modified: moment_1.default(EPOCH).add(modified, "seconds").toISOString(),
        orientation: findOrientation(matrix)
    };
}

function parseTapt(atom) {
    return parseAtoms(getAtoms(atom, 8));
}

function parseTaptLeaf(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const width = readFixedPointBuffer(iterator.next(4));
    const height = readFixedPointBuffer(iterator.next(4));

    return { version, flags, width, height };
}

function parseEdts(atom) {
    return parseAtoms(getAtoms(atom, 8));
}

function parseElst(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const numberOfEntries = iterator.next(4).readUInt32BE(0);

    const entriesIterator = iterate(iterator.rest());
    const entries = [];
    while (entriesIterator.next(12, true)) {
        const entry = {
            trackDuration: entriesIterator.next(4).readInt32BE(0),
            mediaTime: entriesIterator.next(4).readInt32BE(0),
            mediaRate: entriesIterator.next(4).readInt32BE(0)
        };
        entries.push(entry);
    }

    return { version, flags, numberOfEntries, entries };
}

function parseMdia(atom) {
    return parseAtoms(getAtoms(atom, 8));
}

function parseMdhd(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const created = iterator.next(4).readUInt32BE(0);
    const modified = iterator.next(4).readUInt32BE(0);
    const timeScale = iterator.next(4).readUInt32BE(0);
    const duration = iterator.next(4).readUInt32BE(0);
    const language = iterator.next(2).readUInt16BE(0);
    const quality = iterator.next(2).readUInt16BE(0);

    return {
        version, flags, created, modified, timeScale,
        language, quality
    };
}

function parseHdlr(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const componentType = iterator.next(4).toString('ascii');
    const componentSubtype = iterator.next(4).toString('ascii');

    return { version, flags, componentType, componentSubtype };
}

function parseMinf(atom) {
    return parseAtoms(getAtoms(atom, 8));
}

function parseVmhd(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const graphicsMode = iterator.next(2).readUInt16BE(0);
    const opColor = [
        iterator.next(2).readUInt16BE(0),
        iterator.next(2).readUInt16BE(0),
        iterator.next(2).readUInt16BE(0)
    ];

    return { version, flags, graphicsMode, opColor };
}

function parseSmhd(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const balance = iterator.next(2).readUInt16BE(0);
    iterator.next(2);  // Reserved by Apple

    return { version, flags, balance };
}

function parseDinf(atom) {
    return parseAtoms(getAtoms(atom, 8));
}

function parseDref(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const numberOfEntries = iterator.next(4).readUInt32BE(0);

    const dataReferencesAtoms = getAtoms(iterator.rest());
    const dataReferences = dataReferencesAtoms.map((ref) => {
        const refIterator = iterate(ref);
        return {
            size: refIterator.next(4).readUInt32BE(0),
            type: refIterator.next(4).toString('ascii'),
            version: refIterator.next(1).readUInt8(0),
            flags: Array.from(refIterator.next(3)),
            data: Array.from(refIterator.rest())
        };
    });

    return { version, flags, numberOfEntries, dataReferences };
}

function parseStbl(atom) {
    return parseAtoms(getAtoms(atom, 8));
}

function parseStsd(atom) {
    const iterator = iterate(atom, 8);
    const version = iterator.next(1).readUInt8(0);
    const flags = Array.from(iterator.next(3));
    const numberOfEntries = iterator.next(4).readUInt32BE(0);

    const sampleDescriptions = [];
    for (let i = 0; i < numberOfEntries; i++) {
        const size = iterator.next(4, true).readUInt32BE(0);
        if (size === 0) continue;

        const sample = iterator.next(size);
        const sampleIterator = iterate(sample, 4);
        const dataFormat = sampleIterator.next(4).toString('ascii');
        sampleIterator.next(6);  // Reserved
        const dataReferenceIndex = sampleIterator.next(2).readUInt16BE(0);
        const dataBuffer = sampleIterator.rest();
        const data = dataFormat in atomParsersMap ? atomParsersMap[dataFormat](dataBuffer) : null;
        sampleDescriptions.push({ size, dataFormat, dataReferenceIndex, data });
    }

    return { version, flags, numberOfEntries, sampleDescriptions };
}

function parseUdta(atom) {
    return parseAtoms(getAtoms(atom, 8))
        .filter(atom => atom.size > 0);
}

function parseAllF(atom) {
    return atom.readUInt8(8);
}

function parseSelO(atom) {
    return atom.readUInt8(8);
}

function parseWloc(atom) {
    const iterator = iterate(atom, 8);
    const values = [];
    while (iterator.next(2, true)) {
        const value = iterator.next(2).readUInt16BE(0);
        values.push(value);
    }
    return values;
}

function parseAvc1(atom) {
    const iterator = iterate(atom);
    const version = iterator.next(2).readUInt16BE(0);
    const revisionLevel = iterator.next(2).readUInt16BE(0);
    const vendor = iterator.next(4).toString('ascii');
    const temporalQuality = iterator.next(4).readUInt32BE(0);
    const spatialQuality = iterator.next(4).readUInt32BE(0);
    const width = iterator.next(2).readUInt16BE(0);
    const height = iterator.next(2).readUInt16BE(0);
    const horizontalResolution = readFixedPointBuffer(iterator.next(4));
    const verticalResolution = readFixedPointBuffer(iterator.next(4));
    const dataSize = iterator.next(4).readUInt32BE(0);
    const frameCount = iterator.next(2).readUInt16BE(0);

    const compressorNameIterator = iterate(iterator.next(32));
    const compressorNameLength = compressorNameIterator.next(1).readUInt8(0);
    const compressorName = compressorNameIterator.next(compressorNameLength).toString('ascii');

    const depth = iterator.next(2).readUInt16BE(0);
    const colorTableId = iterator.next(2).readUInt16BE(0);
    const parsed = {
        version, revisionLevel, vendor, temporalQuality, spatialQuality, width,
        height, horizontalResolution, verticalResolution, dataSize, frameCount,
        compressorName, depth, colorTableId
    };

    if (![16, 24, 32].includes(depth)) {
        // TODO: Parse color table that follows
    }

    parsed.sampleDescriptionExtensions = parseAtoms(getAtoms(iterator.rest()));

    return parsed;
}

function parseAvcC(atom) {
    const iterator = iterate(atom, 8);
    return Array.from(iterator.rest());
}

function parseColr(atom) {
    const iterator = iterate(atom, 8);
    const colorParameterType = iterator.next(4).toString('ascii');
    const parsed = { colorParameterType };

    if (colorParameterType === 'nclc') {
        parsed.primariesIndex = iterator.next(2).readUInt16BE(0);
        parsed.transferFunctionIndex = iterator.next(2).readUInt16BE(0);
        parsed.matrixIndex = iterator.next(2).readUInt16BE(0);
    } else if (colorParameterType === 'prof') {
        // TODO: Parse ICC profile that follows
    }

    return parsed;
}
