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
const mainSegments = {
  EBML:'#', Info:'#', TrackEntry:'Tracks', AttachedFile:'Attachments', Tag:'Tags'
};
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


const result = {EBML:{}, Info:{}, Tracks:{}, Attachments:{}, Tags:{}};
let target = result;
let prevTarget = result;
let hasEnd = false;

decoder.on('data', (chunk) => {
  const [type, res] = chunk;

  res.name !== 'SimpleBlock' && res.name !== 'Cluster'  && res.name !== 'Timecode' &&
    res.name.slice(0,3) !== 'Cue' &&
      console.log(type,res.name, res.name === 'TargetTypeValue' || res.name === 'TagName' || res.name === 'TagString' ? res.value : '');

  switch (type) {
    case 'start':
      if (hasEnd) {
        target = prevTarget;
        hasEnd = false;
      } else if (mainSegments.hasOwnProperty(res.name)) {
        target = mainSegments[res.name] === '#' ? result[res.name] : result[mainSegments[res.name]];
        prevTarget = target;
      } else {
        prevTarget = target;
        if (!target.hasOwnProperty(res.name)) { target[res.name] = {}; }
        target = target[res.name];
      }
      break;
      /* mainSegments = { EBML:'#', Info:'#', TrackEntry:'Tracks', AttachedFile:'Attachments', Tag:'Tags' };

      start SimpleTag
      tag TagName ACTOR
      tag TagString Daniel Craig
      start SimpleTag
      tag TagName CHARACTER
      tag TagString James Bond
      end SimpleTag
      */

    case 'tag':
      target[res.name] = (res.type === 'd' || res.type === 'b') ? Uint8Array.from(res.data) : res.value;
      break;

    case 'end':
      hasEnd = true;
      break;
  }
});

fs.readFile(FILEPATH, (err, data) => {
  if (err) {
    throw err;
  }
  decoder.write(data);
  console.log(JSON.stringify(result, null, 2))

  /*
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
  */
});
