
const envPrefix = 'PICREAD_'

const readValue = exports.readValue = (key, defaultValue) => {
  const value = process.env[envPrefix + key]
  return value !== undefined ? value : defaultValue
}

const readInt = exports.readInt = (key, defaultValue) => {
  const value = parseInt(readValue(key), 10)
  return !isNaN(value) ? value : defaultValue
}

exports.port = readInt('PORT', 3000)
exports.imageRoot = readInt('IMAGE_ROOT', './public/images')
