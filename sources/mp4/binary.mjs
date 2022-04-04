'use strict';
/*
MIT License

Copyright (c) 2021 Haukur Hlöðversson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const findMarker = (haystack, needle) => {
    if (!(haystack instanceof Uint8Array)) { return null }

    const marker = strToUint8Array(needle);
    const match = marker.toString();
    for (let i = 0; i < haystack.length; i++) {
        if (haystack.slice(i, i + marker.length).toString() === match) {
            return i;
        }
    }
    return null;
}

const findMarkers = (haystack, needle) => {
    if (!(haystack instanceof Uint8Array)) { return null }

    const marker = strToUint8Array(needle);
    const match = marker.toString();
    const markerPositions = [];
    for (let i = 0; i < haystack.length; i++) {
        if (haystack.slice(i, i + marker.length).toString() === match) {
            markerPositions.push(i);
        }
    }
    return markerPositions;
}

const strToUint8Array = (str) => {
    const chars = str.split('').map((letter) => letter.charCodeAt(0));
    return new Uint8Array(chars);
}

const readChars = (uint8Array, position = 4, length = 4) => {
    if (!(uint8Array instanceof Uint8Array) || !Number.isInteger(position) || !Number.isInteger(length)) {
      return null
    }
    return [...uint8Array.slice(position, position + length)]
      .map((char) => String.fromCharCode(char))
      .join('')
      .replace("\u0000", '');
}

const getFixedPoint32 = (uint8Array, byteOffset = 0) => {
    if (!(uint8Array instanceof Uint8Array) || !Number.isInteger(byteOffset)) { return null }

    const first = (new DataView(uint8Array.buffer)).getUint16(byteOffset, false);
    const last = (new DataView(uint8Array.buffer)).getUint16(byteOffset + 2, false);
    return parseFloat(`${first}.${last}`);
};

const getFixedPoint16 = (uint8Array, byteOffset = 0) => {
    if (!(uint8Array instanceof Uint8Array) || !Number.isInteger(byteOffset)) { return null }

    const first = uint8Array[byteOffset];
    const last = uint8Array[byteOffset + 1];
    return parseFloat(`${first}.${last}`);
};

const getInt16 = (uint8Array, byteOffset = 0) => {
    if (!(uint8Array instanceof Uint8Array) || !Number.isInteger(byteOffset)) { return null }
    return (new DataView(uint8Array.buffer))
        .getInt16(byteOffset, false);
};

const getUInt16 = (uint8Array, byteOffset = 0) => {
    if (!(uint8Array instanceof Uint8Array) || !Number.isInteger(byteOffset)) { return null }

    return (new DataView(uint8Array.buffer))
        .getUint16(byteOffset, false);
};

const getInt32 = (uint8Array, byteOffset = 0) => {
    if (!(uint8Array instanceof Uint8Array) || !Number.isInteger(byteOffset)) { return null }

    return (new DataView(uint8Array.buffer))
        .getInt32(byteOffset, false);
};

const getUInt32 = (uint8Array, byteOffset = 0) => {
    if (!(uint8Array instanceof Uint8Array) || !Number.isInteger(byteOffset)) { return null }
    return (new DataView(uint8Array.buffer))
        .getUint32(byteOffset, false);
};

export {
    readChars,
    findMarker,
    findMarkers,
    strToUint8Array,
    getInt16,
    getInt32,
    getUInt16,
    getUInt32,
    getFixedPoint16,
    getFixedPoint32,
};
