// http://mp4ra.org/#/misc and https://www.matroska.org/technical/elements.html
// [mp4, mkv]
export const trackTypes = {
  Video: ['Main Video Track', 'Main Video Track'],
  AuxVideo: ['Auxiliary Video', 'Auxiliary Video'],
  Audio: ['Audio Track', 'Audio Track'],
  Subtitle: ['Video Subtitles', 'Video Subtitles'],
  Meta: ['A timed Metadata Track', false],
  Logo: ['Image Item and Image sequences', 'Logo or Image Item '],
  Control: [false, 'Matroska Control Track'],
  Complex: [false, 'Matroska Complex Track'],
  Buttons: [false, 'Matroska Buttons Track'],
  Text: ['Additional Text Track', 'Additional Text Track'],
  Timecode: ['MP4 Timecode, usually QT or FinalCut',false],
  Hint: ['mp4 Hint', 'Unknown type']
}
// mkv 'Video' [0], each other Video AuxVideo - 'Audio', 'Subtitle' 'Control', 'Complex', 'Logo', 'Buttons', 'Unknown' = Hint
