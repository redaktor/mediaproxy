const fs = require('fs');
const { Decoder } = require('ebml/lib/ebml.js');
const decoder = new Decoder();

const FILEPATH = './data/movTags.mkv';
const TYPE = 'VIDEO'; // AUDIO

const targetTypes = { // Audio, Video
  '70': ['Collection','Collection'],
  '60': ['Edition_Issue_Volume_Opus','Season_Sequel_Volume'],
  '50': ['Album_Concert','Movie'],
  '40': ['Part_Session','Part_Session'],
  '30': ['Track','Chapter'],
  '20': ['Subtrack_Movement','Scene'],
  '10': ['MovementPart','Shot']
}
const trackTypes = [
  '', 'Video', 'Audio', 'Complex', 'Logo', 'Subtitle', 'Buttons', 'Control', 'Unknown'
];
function GetAVCProfileName(profile_int) {
	switch (profile_int)
	{
		case  44 : return "CAVLC 4:4:4 Intra";
		case  66 : return "Baseline";
		case  77 : return "Main";
		case  83 : return "Scalable Baseline";
		case  86 : return "Scalable High";
		case  88 : return "Extended";
		case 100 : return "High";
		case 110 : return "High 10";
		case 118 : return "Multiview High";
		case 122 : return "High 4:2:2";
		case 128 : return "Stereo High";
		case 138 : return "Multiview Depth High";
		case 144 : return "High 4:4:4";
		case 244 : return "High 4:4:4 Predictive";
		default  : return "Unknown";
	}
}
function GetAVCLevel(level_int) {
	return level_int.toString().substring(0,1) + '.'+ level_int.toString().substring(1,2);
}
function GetAACInfo(cPrivBuf) {
  // const int WAVE_FORMAT_PCM = 0x0001;
	// const int WAVE_FORMAT_EXTENSIBLE = 0xFFFE;
  return { formatTag: '0x'+ cPrivBuf.slice(0, 2).toString('hex') }
}
function GetAVCInfo(cPrivBuf) {
	console.log('AVC cbSeqHeader: '+ cPrivBuf.readUInt)
	return {
    profile: GetAVCProfileName(cPrivBuf.readUInt8(1)),
		level: GetAVCLevel(cPrivBuf.readUInt8(3))
  };
}


const a = [];
let curA = [];
let curLang, curKey, curValue, curKeys = [], targets = [], isSimpleTag = false;
decoder.on('data', (chunk) => {
  const [type, res] = chunk;
/*
  res.name !== 'SimpleBlock' && res.name !== 'Cluster'  && res.name !== 'Timecode' &&
    res.name.slice(0,3) !== 'Cue' &&
      console.log(type,res.name, res.name === 'TargetTypeValue' || res.name === 'TagName' || res.name === 'TagString' ? res.value : '');

  if (type+res.name === 'endTag') { console.log('----- ----- -----') }
  if (type+res.name === 'endSimpleTag') { console.log('-----') }
  res.name === 'TargetTypeValue' && targets.push(res.value);
*/
  switch (type) {
    case 'start':
      curKeys.push(res.name);
      a.push(curA);
      curA = [];
      break;
  /*
  start SimpleTag
  tag TagName ACTOR
  tag TagString Daniel Craig
  start SimpleTag
  tag TagName CHARACTER
  tag TagString James Bond
  end SimpleTag
  */

    case 'tag':
      if (res.name === 'TargetType' || res.name === 'TargetTypeValue') {
        curKeys.push(targetTypes.hasOwnProperty(res.value) ? targetTypes[res.value][TYPE === 'AUDIO' ? 0 : 1] : res.value);
      } else if (res.name === 'TagLanguage') {
        curLang = res.value;
      } else if (res.name === 'TagName') {
        curKey = res.value;
      } else {
        if (res.name.slice(0,3) !== 'Tag') {
          curKey = res.name;
        }
        curValue = !!curKeys.length && (res.type === 'd' || res.type === 'b') ? Uint8Array.from(res.data) : res.value;
      }
      const isEmptyCluster = curKeys.length === 1 && curKeys[0] === 'Cluster';
      if (!!curValue && !isEmptyCluster) {
        curA.push([JSON.parse(JSON.stringify(curKeys)), curKey, curValue, curLang||'und']);
      }
      break;

    case 'end':
      curKeys.pop();
      curKey = void 0;
      curLang = void 0;
      curValue = void 0;
      break;
  }
});

fs.readFile(FILEPATH, (err, data) => {
  if (err) {
    throw err;
  }
  decoder.write(data);


/*
  console.log('Targets');
  console.log(JSON.stringify(targets, null, 2));
*/
  /*["EBML", "Segment,SeekHead,Seek", "Tracks,TrackEntry,Audio", "Tracks,TrackEntry,Video",
  "Attachments,AttachedFile", "Cues,CuePoint,CueTrackPositions",
  "Tags,Tag,Targets", "Tags,Tag,SimpleTag", "Tags,Tag,SimpleTag,SimpleTag"] */
  let V;
  const o = a.reduce((newO, _a, i) => {
    _a.forEach(([keys, key, value, lang]) => {
      let prevKey, curEl = newO||{};

      let target;
      keys.forEach((k) => {
        if (!curEl.hasOwnProperty(k)) { curEl[k] = {}; }
        curEl = curEl[k];
        if (k === prevKey && !!i) {
          target = a[i-1];
          console.log(':!:!: ', k, key, value, lang, keys, JSON.stringify(curEl), target);
        }
        prevKey = k;
      });
      if (!curEl[key]) { curEl[key] = [] }
      const isTag = keys[0] === 'Tags';
      curEl[key].push(isTag ? [value, lang, target] : value);
    });
    return newO
  }, {});
 console.log(JSON.stringify(o.Tags,null,2))
  const sv = (obj) => {
    if (typeof obj === 'object') {
      for (let [k, v] of Object.entries(obj)) {
        if (typeof v === 'object') {
          if (!Array.isArray(v) && !!v) {
            obj[k] = sv(v)
          }
          if (Array.isArray(v) && v.length === 1) { obj[k] = v[0] }
        }
      }
    }
    return obj
  }

  for (let [key, value] of Object.entries(o)) {
    if (key !== 'Attachments' && key !== 'Tags' && typeof o[key] === 'object') {
      o[key] = sv(o[key]);
    }
  }

  const tags = {};
  let partOf = '#';
  let parent = tags;

  if (o.hasOwnProperty('Tags')) {
    const pusher = (_o,isTargets) => {
      for (let [_k, _v] of Object.entries(_o)) {
        // Tag.Targets
        if (_k === 'Tag') { isTargets = false; }
        if (isTargets) {
          partOf = _k;
        }
        console.log('K',typeof _k,_k,isTargets,partOf);
        if (_k === 'Tag' || _k === 'Targets') {
          if (_k === 'Targets') { console.log('Targets',_v); }
          pusher(_v, _k === 'Targets');
          continue;
        }
      }
    }
    pusher(o.Tags);
  }


    /*
    let partOf = 'Collection';

    const pusher = (_o,isTargets) => {
      for (let [_k, _v] of Object.entries(_o)) {
        // Tag.Targets
        if (_k === 'Tag') { isTargets = false; }
        if (isTargets) {
          partOf = _k;
        }
        console.log('K',typeof _k,_k,isTargets,partOf);
        if (_k === 'Tag' || _k === 'Targets') {
          if (_k === 'Targets') { console.log('Targets',_v); }
          pusher(_v, _k === 'Targets');
          continue;
        }
      }
    }
    pusher(o.Tags);
    const pusher = (_o) => {
      if (_o.hasOwnProperty('Targets')) {
        _o = {..._o, ..._o.Targets};
      }
      console.log(typeof _o, typeof o !== 'object' && _o);
      for (let [_k, _v] of Object.entries(_o)) {
        if (_k === 'Tag') {
          pusher(_o[_k])
        } else if (_k === 'Targets' && typeof _v === 'object') {
          for (let [type, target] of Object.entries(_v)) {
            // target = target.hasOwnProperty('SimpleTag') ? target.SimpleTag : target;
            if (type === 'Tag') {
              return pusher(target)
            }

            if (typeof target !== 'object') { continue }
            console.log('type, target', type, target)
            if (!tags.hasOwnProperty(type)) { tags[type] = {} }
            for (let [k, v] of Object.entries(target)) {
              v = v.hasOwnProperty('SimpleTag') ? v.SimpleTag : v;

              console.log('v',v)

              if (Array.isArray(v)) {
                v.forEach(([value,lang], i) => {
                  if (!tags[type].hasOwnProperty(k)) { tags[type][k] = {}; }
                  tags[type][k][lang] = value;
                });
              } else {
                tags[type][k] = v;
              }
            }
          }
        }
      }
      o.Tags = tags;
    }

    console.log ('---');
    // console.log (JSON.stringify(o.Tags.Tag.Targets, null, 2));
    console.log (JSON.stringify(Object.entries(o.Tags), null, 2));
    console.log ('---');
    pusher(o.Tags.Tag);
    */

  if (o.hasOwnProperty('Cues') && o.Tracks.hasOwnProperty('TrackEntry')) {

  }

  if (o.hasOwnProperty('Tracks')) {
    if (o.Tracks.hasOwnProperty('TrackEntry') && o.Tracks.TrackEntry.hasOwnProperty('TrackType')) {
      const types = o.Tracks.TrackEntry.TrackType.map((i) => trackTypes[Math.min(trackTypes.length-1, i)]);
      o.Tracks = types.map((type, i) => {
        const res = {type};
        for (let [k, v] of Object.entries(o.Tracks.TrackEntry)) {
          if (k === type) {
            for (let [_k, _v] of Object.entries(o.Tracks.TrackEntry[type])) {
              res[_k] = (Array.isArray(_v) && !!_v[i]) ? _v[i] : _v;
            }
            delete o.Tracks.TrackEntry[type]
          } else if (types.indexOf(k) < 0) {
            res[k] = (Array.isArray(v) && !!v[i]) ? v[i] : v;
          }
        }
        return res
      })
      .map((track) => {
        if (track.hasOwnProperty('CodecPrivate')) {
          track.CodecPrivate = track.type === 'Video' ?
            GetAVCInfo(Buffer.from(track.CodecPrivate)) :
            (track.type === 'Audio' ? GetAACInfo(Buffer.from(track.CodecPrivate)) : track.CodecPrivate);
        }
        return track
      })
      .sort((a, b) => { return (a.TrackNumber||99) - (b.TrackNumber||99); });
    }
  }
  if (o.hasOwnProperty('Attachments') && o.Attachments.hasOwnProperty('AttachedFile')) {
    if (o.Attachments.AttachedFile.hasOwnProperty('FileUID')) {
      const unifyKeys = { FileName: 'name', FileMimeType: 'mimeType', FileData: 'data' }
      const supportedMime = {'image/jpeg':'jpg', 'image/jpg': 'jpg', 'image/png': 'png'};
      o.Attachments = o.Attachments.AttachedFile.FileUID.map((uid, i) => {
        if (
          !Array.isArray(o.Attachments.AttachedFile.FileMimeType) || !o.Attachments.AttachedFile.FileMimeType[i] ||
          !supportedMime.hasOwnProperty(o.Attachments.AttachedFile.FileMimeType[i])
        ) {
          return false
        }
        if (!Array.isArray(o.Attachments.AttachedFile.FileData) || !o.Attachments.AttachedFile.FileData[i]) {
          return false
        }
        const res = {
          uid,
          mimeType: o.Attachments.AttachedFile.FileMimeType[i],
          extension: supportedMime[o.Attachments.AttachedFile.FileMimeType[i]],
        };
        if (!Array.isArray(o.Attachments.AttachedFile.FileName) || !o.Attachments.AttachedFile.FileName[i]) {
          res.name = o.Attachments.AttachedFile.FileName[i];
        }
        res.data = o.Attachments.AttachedFile.FileData[i];
        return res
      });
    }
  }
  /*
"Attachments":{"AttachedFile":{"FileName":["cover.jpg","small_cover.jpg","cover_land.jpg","small_cover_land.jpg"],
"FileMimeType":["image/jpeg","image/jpeg","image/jpeg","image/jpeg"],"FileUID":[1495003044,2800705980,3315518851,3317823672]}},
  */
  const {
    EBML,
    Info = {},
    Tags = {},
    Cues = {},
    Tracks = [],
    Attachments = []
  } = o;
  const result = !EBML ? {} : {
    EBML,
    info: Info,
    tags: Tags,
    cues: Cues,
    tracks: Tracks,
    attachments: Attachments
  }
  console.log('END!');
  // console.log(JSON.stringify(a));
  console.log(JSON.stringify(result, null, 2));
});
