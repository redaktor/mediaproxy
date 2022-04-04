
// NOTE: see https://github.com/node-ebml/node-ebml/pull/113 for browser
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
function DateFromBuffer(buf, index = 0) {
  var hStr = buf.toString('hex', index, index+8);
  var nanoSecs = parseInt(hStr, 16);
  var milliSecs = nanoSecs / 1e6;
  return new Date(9783072e5 + milliSecs);
}
function EBML_AVCprofileName(profile_int) {
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
function EBML_AVClevel(level_int) {
  return level_int.toString().substring(0,1) + '.'+ level_int.toString().substring(1,2);
}
function EBML_AAC(cPrivBuf) {
  return { formatTag: '0x'+ cPrivBuf.slice(0, 2).toString('hex') }
}
function EBML_AVC(cPrivBuf) {
  return {
    profile: EBML_AVCprofileName(cPrivBuf.readUInt8(1)),
    level: EBML_AVClevel(cPrivBuf.readUInt8(3))
  };
}

export const mkvToLD = { /* [ldVocab, ldKey, asKey?, asExtraType?] */
/*
Collection, Season_Sequel_Volume, Movie, Part_Session, Chapter, Scene, Shot

ORIGINAL A special tag that is meant to have other tags inside (using nested tags)
to describe the original work of art that this item is based on.
All tags in this list can be used “under” the ORIGINAL tag like LYRICIST, PERFORMER, etc.

SAMPLE A special tag that contains other tags to describe a sample used in the
targeted item taken from another work of art.
All tags in this list can be used “under” the SAMPLE tag like TITLE, ARTIST, DATE_RELEASED, etc.
schema.org ?
---
(id)
ISRC, MCDI, ISBN, BARCODE, CATALOG_NUMBER, LABEL_CODE, LCCN, IMDB, TMDB, TVDB

INITIAL_KEY, LAW_RATING, PLAY_COUNTER
ORIGINAL_MEDIA_TYPE, Describes the original type of the media, such as, “DVD”, “CD”, “computer image …
CONTENT_TYPE, // not confuse, is e.g. schema.org type
*/

/* TODO redaktor roles and content label-types (e.g. Description, Synopsis) and ids*/
  TITLE: ['dc', 'title', 'name'], // TIT2 in ID3
  SUBTITLE: ['dc', 'title', 'name'],
  SUMMARY: ['dc', 'description', 'summary'],
  DESCRIPTION: ['dc', 'description', 'content'],
  SYNOPSIS: ['dc', 'description', 'content'],
  COMMENT: ['xmpDM', 'comment', 'content'],
  KEYWORDS: ['dc', 'title', 'tag'],
  SUBJECT: ['dc', 'title', 'tag'], /* SUBJECT // TOPIC */
  // ['Iptc4xmpCore', 'IntellectualGenre', 'context'], TODO
  // catg:   ['Iptc4xmpCore', 'IntellectualGenre', 'context'],
  GENRE: ['xmpDM', 'genre', 'context', 'Genre'], // TCON in ID3
  MOOD: ['xmpDM', 'genre', 'context', 'Mood'], // TMOO in ID3
  RATING: ['xmp', 'Rating'],
  DATE_RELEASED: ['xmpDM', 'releaseDate'],
  DATE_RECORDED: ['xmpDM', 'shotDate'],
  DATE_ENCODED: ['xmp', 'CreateDate'],
  DATE_DIGITIZED: ['xmp', 'CreateDate'],
  DATE_TAGGED: ['xmp', 'MetadataDate'],
  COPYRIGHT: ['dc', 'rights', 'attributedTo', 'Copyright'],
  PRODUCTION_COPYRIGHT: ['dc', 'rights', 'attributedTo', 'ProductionCopyright'],
  LICENSE: ['dc', 'license', 'summary'],
  TERMS_OF_USE: ['xmpRights', 'UsageTerms'],
  // ENCODER_SETTINGS,
  BPS: ['xmpDM', 'tempo', 'instrument'],
  FPS: ['xmpDM', 'tempo', 'instrument'],
  BPM: ['xmpDM', 'tempo', 'instrument'],
  ENCODER: ['xmp', 'CreatorTool', 'generator'],
  PART_NUMBER: ['xmpDM', 'trackNumber'],
  LABEL: ['xmpDM', 'projectName', 'context', 'ProjectName'],
  LYRICS: ['xmpDM', 'lyrics'],
  //
  LEAD_PERFORMER: ['dc', 'contributor', 'attributedTo', 'LeadPerformer'],
  ACTOR: ['dc', 'contributor', 'attributedTo', 'Actor'], // TODO !!! LEAD_PERFORMER, ACTOR -> CHARACTER !!!
  //
  ARTIST: ['xmpDM', 'artist', 'attributedTo', 'Artist'], // TPE1 in ID3
  COMPOSER: ['xmpDM', 'composer', 'attributedTo', 'Composer'], // TCOM in ID3
  DIRECTOR: ['xmpDM', 'director', 'attributedTo', 'Director'],
  DIRECTOR_OF_PHOTOGRAPHY: ['xmpDM', 'directorPhotography', 'attributedTo', 'DirectorOfPhotography'],
  SOUND_ENGINEER: ['xmpDM', 'engineer', 'attributedTo', 'Sound Engineer'],
  PRODUCTION_STUDIO: ['schema', 'productionCompany', 'attributedTo', 'ProductionStudio'],
  PRODUCER: ['schema', 'producer', 'attributedTo', 'Producer'],
  // ?xid:   ['xmpRights', 'Owner', 'attributedTo', 'Owner'],
  ACCOMPANIMENT:   ['dc', 'contributor', 'attributedTo', 'Accompaniment'], // TPE2 in ID3
  LYRICIST:   ['dc', 'contributor', 'attributedTo', 'Lyricist'], // TEXT in ID3
  CONDUCTOR:   ['dc', 'contributor', 'attributedTo', 'Conductor'], // TPE3 in ID3
  PUBLISHER:   ['dc', 'contributor', 'attributedTo', 'Publisher'], // TPUB in ID3
  ENCODED_BY:   ['dc', 'contributor', 'attributedTo', 'EncodedBy'], // TENC in ID3
  REMIXED_BY:   ['dc', 'contributor', 'attributedTo', 'RemixedBy'], // TPE4 in ID3
  ARRANGER: ['dc', 'contributor', 'attributedTo', 'Arranger'],
  ASSISTANT_DIRECTOR: ['dc', 'contributor', 'attributedTo', 'AssistantDirector'],
  ART_DIRECTOR: ['dc', 'contributor', 'attributedTo', 'ArtDirector'],
  PRODUCTION_DESIGNER: ['dc', 'contributor', 'attributedTo', 'ProductionDesigner'],
  CHOREGRAPHER: ['dc', 'contributor', 'attributedTo', 'Choreographer'],
  COSTUME_DESIGNER: ['dc', 'contributor', 'attributedTo', 'CostumeDesigner'],
  WRITTEN_BY: ['dc', 'contributor', 'attributedTo', 'WrittenBy'],
  SCREENPLAY_BY: ['dc', 'contributor', 'attributedTo', 'ScreenplayBy'],
  EDITED_BY: ['dc', 'contributor', 'attributedTo', 'EditedBy'],
  COPRODUCER: ['dc', 'contributor', 'attributedTo', 'CoProducer'],
  EXECUTIVE_PRODUCER: ['dc', 'contributor', 'attributedTo', 'ExecutiveProducer'],
  DISTRIBUTED_BY: ['dc', 'contributor', 'attributedTo', 'DistributedBy'],
  MASTERED_BY: ['dc', 'contributor', 'attributedTo', 'MasteredBy'],
  MIXED_BY: ['dc', 'contributor', 'attributedTo', 'MixedBy'],
  THANKS_TO: ['dc', 'contributor', 'attributedTo', 'thanksTo']

}

export const getMeta = async (data, TYPE = 'VIDEO') => {
  const targetOrder = ['70','60','50','40','30','20','10'].map((k) => {
    return targetTypes[k][TYPE === 'AUDIO' ? 0 : 1]
  });
  return new Promise(async (resolve, reject) => {
    try {
    const { Decoder } = await import('ebml/lib/ebml.js');
    const decoder = new Decoder();
    const a = [];

    let curA = [];
    let curLang, curKey, curValue, curKeys = [], targets = [], isSimpleTag = false;
    decoder.on('data', (chunk) => {
      const [type, res] = chunk;

      switch (type) {
        case 'start':
          curKeys.push(res.name);
          a.push(curA);
          curA = [];
          break;

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

            // TODO uncomment
            curValue = res.type === 'd' ? DateFromBuffer(Buffer.from(Uint8Array.from(res.data))) :
              (!!curKeys.length && res.type === 'b' ? Uint8Array.from(res.data) : res.value);
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

    decoder.write(data);

    const o = a.reduce((newO, _a, i) => {
      _a.forEach(([keys, key, value, lang]) => {
        let prevKey, curEl = newO||{};

        let target;
        keys.forEach((k) => {
          if (!curEl.hasOwnProperty(k)) { curEl[k] = {}; }
          curEl = curEl[k];
          if (k === prevKey && !!i) {
            if (Array.isArray(a[i-1]) && !!a[i-1].length) {
              target = a[i-1][0];
            }
            // console.log(':!:!: ', k, key, value, lang, keys, JSON.stringify(curEl), target);
          }
          prevKey = k;
        });
        if (!curEl[key]) { curEl[key] = [] }
        const isTag = keys[0] === 'Tags';
        curEl[key].push(isTag ? [{name: value}, lang, target] : value);
      });
      return newO
    }, {});
    // console.log(JSON.stringify(o.Tags,null,2))
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


    //console.log(o.Tags.Tag.Targets.Tag.Targets.hasOwnProperty('Movie'),o.Tags.Tag.Targets.Tag.Targets)

    if (o.hasOwnProperty('Tags') && o.Tags.hasOwnProperty('Tag') ) {
      const tags = {order: targetOrder};
      targetOrder.forEach((tk) => { tags[tk] = {}; });
      let curTarget = tags;

      let partOf = '#';
      let parent = tags;
      const getByKeys = (keys, tagObj) => {
        const L = keys.length;
        if (!L) { return tagObj }
        let o = tagObj;
        for (let i = 0; i < L; ++i) {
          const tok = keys[i];
          if (tok === '#') { continue }
          if (typeof o !== 'object' || !(tok in o)) { return o }
          o = o[tok];
        }
        return o;
      }

      const handleSimpleTag = (key, tag) => {
        const knownTarget = targetOrder.indexOf(key) > -1;
        if (typeof tag === 'undefined') { return }

        if (!knownTarget && key !== '#' && !!parent) {
          if (!parent.hasOwnProperty(key)) { parent[key] = {} }
          parent = parent[key];
        } else {
          parent = !!knownTarget ? tags[key] : tags;
        }
        for (let [k, v] of Object.entries(tag)) {
          if (k === 'Tag') {
            handleTag(v);
          } else if (k === 'SimpleTag') {
            handleSimpleTag(key, v);
            continue;
          }
          if (typeof v !== 'object' || !Array.isArray(v)) {
            parent[k] = v
          } else {

            v.forEach((a, i) => {
              const [res, lang, target] = a;
              if (!!target) {
                const [keys, key, value, tlang] = target;
                const targetO = getByKeys(keys, o);
                if (!parent.hasOwnProperty(key)) { parent[key] = {} }
                if (!parent[key].hasOwnProperty(lang)) { parent[key][tlang] = [] }

                let handled = false;
                if (Array.isArray(parent[key][tlang])) {
                  const existingName = parent[key][tlang].filter((el) => {
                    return el.name === value
                  });
                  if (!!existingName.length) {
                    parent[key][tlang] = parent[key][tlang].map((el) => {
                      if (el.name === value) {
                        if (!el.hasOwnProperty(k)) { el[k] = []; }
                        el[k].push({name: res.name});
                        handled = true
                      }
                      return el;
                    });
                  }
                }

                if (!handled) {
                  if (res.name === value) { return }
                  const newRes = { name: value };
                  if (!newRes.hasOwnProperty(k)) { newRes[k] = []; }
                  newRes[k].push({name: res.name});
                  parent[key][tlang].push(newRes);
                }


                /*
                if (!parent[key][lang].hasOwnProperty('name')) {
                  parent[key][lang].name = value;
                }
                if (!parent[key][lang].hasOwnProperty(k)) {
                  parent[key][lang][k] = [];
                }
                parent[key][lang][k].push({name: res.name});
                */
                //
              } else {
                if (!parent.hasOwnProperty(k)) { parent[k] = {}; }
                if (!parent[k].hasOwnProperty(lang)) { parent[k][lang] = [] }
                const existingName = parent[k][lang].filter((el) => {
                  return el.name === res.name
                });
                if (!existingName.length) {
                  parent[k][lang].push(res);
                }
              }
            });

          }
        }
      }

      const handleTarget = (key, target) => {
        const knownTarget = targetOrder.indexOf(key) > -1;
        if (!!knownTarget) {
          parent = tags;
        } else {
          if (!parent) { parent = tags; }
          if (!parent.hasOwnProperty(key)) { parent[key] = {} }
        }

        for (let [k, v] of Object.entries(target)) {
          if (k === 'Tag') {
            handleTag(v);
          } else if (k === 'SimpleTag') {
            handleSimpleTag(key, v);
          }
        }
        return parent[key]
      }

      const handleTag = (tag) => {
        if (tag.hasOwnProperty('Targets')) {
          for (let [k, v] of Object.entries(tag.Targets)) {
            if (k === 'Tag') {
              handleTag(v);
            } else if (k === 'SimpleTag') {
              handleSimpleTag('#', v);
            } else {
              parent = handleTarget(k, v);
            }
          }
        }
        if (tag.hasOwnProperty('Tag')) {
          handleTag(tag.Tag);
        }
      }
      handleTag(o.Tags.Tag);
      o.Tags = tags;
    }

    if (o.hasOwnProperty('Cues') && o.Tracks.hasOwnProperty('TrackEntry')) {
      // Cues should be at start for fast streaming
      // WebM files SHOULD include a keyframe-only Cues element.
      // All absolute (block + cluster) timecodes MUST be monotonically increasing.

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
              EBML_AVC(Buffer.from(track.CodecPrivate)) :
              (track.type === 'Audio' ? EBML_AAC(Buffer.from(track.CodecPrivate)) : track.CodecPrivate);
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
          if (!!Array.isArray(o.Attachments.AttachedFile.FileName) && !!o.Attachments.AttachedFile.FileName[i]) {
            res.name = o.Attachments.AttachedFile.FileName[i];
          }
          res.data = o.Attachments.AttachedFile.FileData[i];
          return res
        });
      }
    }



    const {
      EBML,
      Info = {},
      Tags = {},
      Cues = {},
      Tracks = [],
      Attachments = []
    } = o;
    const baseInfo = {};
    if (!!Info && !!Info.Duration) {
      baseInfo.duration = Info.Duration;
    }
    const videos = Tracks.filter((t) => t.type === 'Video');
    if (!!videos.length) {
      let [width, height] = [0, 0];
      for (let v of videos) {
        if (v.hasOwnProperty('DisplayWidth') && v.hasOwnProperty('DisplayHeight')) {
          width = v.DisplayWidth;
          height = v.DisplayHeight;
          break;
        }
      }
      if (!!width && !!height) {
        baseInfo.width = width;
        baseInfo.height = height;
      }
    }
    const compatibleBrands = ['mkv'];
    if (data[0] === 26 && data[1] === 69 && data[2] === 223 && data[3] === 163) {
      const compatVideo = Tracks.filter((t) => t.type === 'Video' && (t.CodecID === 'V_VP8' || t.CodecID === 'V_VP8'));
      const compatAudio = Tracks.filter((t) => t.type === 'Audio' && (t.CodecID === 'A_VORBIS' || t.CodecID === 'A_OPUS'));
      if (!!compatVideo.length && !!compatAudio.length) {
        compatibleBrands.push('webm');
      }
    }
    const result = !EBML ? {} : {
      ...baseInfo,
      EBML,
      info: Info,
      tags: Tags,
      cues: Cues,
      tracks: Tracks,
      attachments: Attachments
    }

    // console.log('END!');
    // console.log(JSON.stringify(a));
    // console.log(JSON.stringify(result, null, 2));
    resolve(result);
  } catch(e) { console.log('ERROR',e); resolve({error:e} )}
  });
}
