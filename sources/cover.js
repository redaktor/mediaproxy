const sharp = require('sharp');
const convert = async (covr, path = '', isBuffer = false) => {
  const { data, extension, name = 'cover' } = covr;
  if (!data) { return }
  if (!path.length) { path = name }
  const filePath = path.slice(0-extension.length) === extension ? path : `${path}.${extension}`;
  const res = !isBuffer ? await sharp(data).toFile(filePath) : await sharp(data).toBuffer(filePath);
  return res
}
exports.coverToFile = async (covr, path = '') => { return convert(covr, path) }
exports.coverToBuffer = async (covr, path = '') => { return convert(covr, path, true) }
