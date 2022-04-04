/* This XMP parser is very naive and dirty, parses https or filestreams */
const fs = require("fs");
const https = require("https");
const tagNamePartRegex = '[\\w\\d-]+';
const VALUE_PROP = 'value';
const identifiableTags = [
	// Basic lists and items
	'rdf:li', 'rdf:Seq', 'rdf:Bag', 'rdf:Alt',
	// This is special case when list items can immediately contain nested rdf:Description
	// e.g. <rdf:Bag><rdf:li><rdf:Description mwg-rs:Name="additional data"><... actual inner tag ...></rdf:Description></rdf:li></rdf:Bag>
	'rdf:Description'
]
const nestedLiRegex = new RegExp(`(<|\\/)(${identifiableTags.join('|')})`, 'g');

function assignToObject(prop, target) {
	let serialized = prop.serialize();
	if (serialized !== undefined)
		target[prop.name] = serialized
}

var getNamespace = (ns, root) => root[ns] ? root[ns] : root[ns] = {}

function matchAll(string, regex) {
	let matches = []
	if (!string) return matches
	let match
	while ((match = regex.exec(string)) !== null)
		matches.push(match)
	return matches
}

function normalizeValue(value) {
	if (isUndefinable(value)) return undefined
	let num = Number(value)
	if (!Number.isNaN(num)) return num
	let lowercase = value.toLowerCase()
	if (lowercase === 'true') return true
	if (lowercase === 'false') return false
	return value.trim()
}

function isUndefinable(value) {
	return value === null
		|| value === undefined
		|| value === 'null'
		|| value === 'undefined'
		|| value === ''
		|| value.trim() === ''
}


class XmlAttr {

	static findAll(string) {
		// NOTE: regex has to be recreated each time because it's stateful due to use in exec()
		let regex = /([a-zA-Z0-9-]+):([a-zA-Z0-9-]+)=("[^"]*"|'[^']*')/gm
		return matchAll(string, regex).map(XmlAttr.unpackMatch)
	}

	static unpackMatch(match) {
		let ns = match[1]
		let name = match[2]
		let value = match[3].slice(1, -1)
		value = normalizeValue(value)
		return new XmlAttr(ns, name, value)
	}

	constructor(ns, name, value) {
		this.ns = ns
		this.name = name
		this.value = value
	}

	serialize() {
		return this.value
	}

}
class XmlTag {

	static findAll(xmpString, ns, name) {
		// NOTE: regex has to be recreated each time because it's stateful due to use in exec()
		// handles both pair and self-closing tags.
		if (ns !== undefined || name !== undefined) {
			ns   = ns   || tagNamePartRegex
			name = name || tagNamePartRegex
			var regex = new RegExp(`<(${ns}):(${name})(#\\d+)?((\\s+?[\\w\\d-:]+=("[^"]*"|'[^']*'))*\\s*)(\\/>|>([\\s\\S]*?)<\\/\\1:\\2\\3>)`, 'gm')
		} else {
			var regex = /<([\w\d-]+):([\w\d-]+)(#\d+)?((\s+?[\w\d-:]+=("[^"]*"|'[^']*'))*\s*)(\/>|>([\s\S]*?)<\/\1:\2\3>)/gm
		}
		return matchAll(xmpString, regex).map(XmlTag.unpackMatch)
	}

	static unpackMatch(match) {
		let ns = match[1]
		let name = match[2]
		let attrString = match[4]
		let innerXml = match[8]
		return new XmlTag(ns, name, attrString, innerXml)
	}

	constructor(ns, name, attrString, innerXml) {
		this.ns = ns
		this.name = name
		this.attrString = attrString
		this.innerXml = innerXml
		this.attrs = XmlAttr.findAll(attrString)
		this.children = XmlTag.findAll(innerXml)
		this.value = this.children.length === 0 ? normalizeValue(innerXml) : undefined
		this.properties = [...this.attrs, ...this.children]
    this.test = false
	}

	get isPrimitive() {
		return this.value !== undefined
			&& (this.attrs.length === 0 || (this.attrs.length === 1 && this.attrs[0].name === 'lang' && this.attrs[0].value === 'x-default'))
			&& this.children.length === 0
	}

	get isListContainer() {
		return this.children.length === 1
			&& this.children[0].isList
	}

	get isList() {
		let {ns, name} = this
		return (ns === 'rdf' || ns === 'dc')
			&& (name === 'Seq' || name === 'Bag' || name === 'Alt')
	}

	get isListItem() {
		return this.ns === 'rdf' && this.name === 'li'
	}

	serialize() {
    const serialize = prop => prop.serialize();
    const unwrapArray = array => array.length === 1 ? array[0] : array;
		// invalid and undefined
		if (this.properties.length === 0 && this.value === undefined){
			return undefined
    }
		// primitive property
		if (this.isPrimitive){
			return this.value
    }
		// tag containing list tag <ns:tag><rdf:Seq>...</rdf:Seq></ns:tag>
		if (this.isListContainer) {
      return this.children[0].serialize()
    }
		// list tag itself <rdf:Seq>...</rdf:Seq>
		if (this.isList) {
      return unwrapArray(this.children.map(serialize))
    }
		// sometimes <rdf:li> may have a single object-tag child. We need that object returned.
		if (this.isListItem && this.children.length === 1 && this.attrs.length === 0){
			return this.children[0].serialize()
    }
		// process attributes and children tags into object
		let output = {}
		for (let prop of this.properties)
			assignToObject(prop, output)
		if (this.value !== undefined)
			output[VALUE_PROP] = this.value
		return undefinedIfEmpty(output)
	}

}

function idNestedTags(xmpString) {
	let stacks = {}
	let counts = {}
	for (let tag of identifiableTags) {
		stacks[tag] = []
		counts[tag] = 0
	}
	return xmpString.replace(nestedLiRegex, (match, prevChar, tag) => {
		if (prevChar === '<') {
			let id = ++counts[tag]
			stacks[tag].push(id)
			return `${match}#${id}`
		} else {
			let id = stacks[tag].pop()
			return `${match}#${id}`
		}
	})
}
function isEmpty(arg) {
	if (arg === undefined) return true
	if (arg instanceof Map) {
    return arg.size === 0
  }
  const isDefined = val => val !== undefined;
  return Object.values(arg).filter(isDefined).length === 0
}
function undefinedIfEmpty(o) { return isEmpty(o) ? undefined : o }
function normalizeInput(input) {
	return typeof input === 'string' ? input : input.toString('utf8');
}
function removeNullTermination(string) {
	while (string.endsWith('\0')) {
		string = string.slice(0, -1)
	}
	return string
}
function normalizeString(string) {
	if (typeof string !== 'string') { return }
	// remove remaining spaces (need to be after null termination!)
	string = removeNullTermination(string).trim()
	return string === '' ? undefined : string
}
// removes undefined properties and empty objects
function pruneObject(o) {
	let v;
	for (let k in o) {
		v = o[k] = undefinedIfEmpty(o[k])
		if (v === undefined) {
			delete o[k]
		} else if (typeof v === 'string') {
			v = normalizeString(v)
		} else if (typeof v === 'string' && !!v && !Array.isArray(v)) {
			v = pruneObject(v)
		}
	}
	return undefinedIfEmpty(o)
}
exports.parse = function parse(atom, raw = true) {
  let xmpXml = normalizeInput(atom);
  if (raw === true) {
    const [prefix, ...parts] = xmpXml.split('XMP_');
    xmpXml = parts.join('');
  }
  const xmpString = idNestedTags(xmpXml);
  let tags = XmlTag.findAll(xmpString, 'rdf', 'Description');
  if (tags.length === 0) {
    tags.push(new XmlTag('rdf', 'Description', undefined, xmpString))
  }
  let xmp = {}
  let namespace;
  for (let tag of tags) {
    for (let prop of tag.properties) {
      namespace = getNamespace(prop.ns, xmp);
      assignToObject(prop, namespace);
    }
  }
  return pruneObject(xmp)
}

exports.parseXML = function parseXML(xmlString) {
  return exports.parse(xmlString, false)
}

exports.find = async function findXMP(targetLink) {
	const EMPTY = {data: targetLink instanceof Uint8Array ? targetLink : null, xmp:{}};
	const isHTTPS = typeof targetLink === 'string' && targetLink.trim().indexOf('https:/') === 0;

	// console.log('xmp', targetLink instanceof Uint8Array, isHTTPS, targetLink);
  return new Promise((resolve, reject) => {
		if (typeof targetLink !== 'string' && !(targetLink instanceof Uint8Array)) { resolve({}) }
		const [opener, closer] = ['<x:xmpmeta', '</x:xmpmeta'];

		const streamFn = (stream) => {
			const [data, lines, xmp] = [[], [], {}];
      let hasXMP = false;
			stream.on('data', async (line) => {
				if (!line) { return }
				data.push(line);
        if (line.indexOf(opener) > -1) {
					// console.log('a',Buffer.byteLength(line), line.toString('utf8'))
          hasXMP = true;
          line = line.slice(line.indexOf(opener))
        }
        if (line.indexOf(closer) > -1) {
					// console.log('b', Buffer.byteLength(line), line.toString('utf8'))
          line = line.slice(0, line.indexOf(closer)+closer.length)+'>'
        }
        lines.push(hasXMP ? line : '');

				if ((lines.length > 2000 && !hasXMP) || (hasXMP && line.indexOf(closer) > -1)) {
          if (!hasXMP) { return }
          const xmlString = lines.join('');
          xmp = exports.parseXML(xmlString);
        }
			});
			stream.on('end', () => resolve({data, xmp}));
			stream.on('error', (err) => resolve(EMPTY));
		}

    try {
			if (targetLink instanceof Uint8Array) {
				const decoded = new TextDecoder().decode(targetLink);
				const [start, end] = [ decoded.indexOf(opener), decoded.indexOf(closer) ];
				if (start > -1 && end > start) {
					const xmp = exports.parseXML(`${decoded.slice(start, end)}${closer}>`);
					return resolve({data: targetLink, xmp})
				}
				return resolve(EMPTY)
			} else if (isHTTPS) {
				https.get(targetLink, {method:'HEAD'}, (stream) => {
					if (!stream.headers.hasOwnProperty('content-length') || !stream.headers['content-length']) {
						return resolve(EMPTY)
					}
					const length = parseInt(stream.headers['content-length'], 10);
					if (isNaN(length) || length < 1024) {
						return resolve(EMPTY)
					}
					const options = { headers: { range: `bytes 0-1023/${length}` }};
					https.get(targetLink, options, streamFn);
				});
			} else {
				fs.stat(targetLink, function (err, stats) {
					if (!!err || isNaN(stats.size) || stats.size < 1024) {
						return resolve(EMPTY)
					}
					const options = { headers: { range: `bytes 0-1023/${stats.size}` }};
					streamFn(fs.createReadStream(targetLink));
				});
			}
    } catch(e) {
			console.log(e);
    }

		resolve(EMPTY)
  });
}
