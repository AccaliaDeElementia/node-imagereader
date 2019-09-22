'use sanity'

const config = require('./config')

const { spawn } = require('child_process')

const { join } = require('path')

const { hash } = require('imghash')
const sharp = require('sharp')

class PerceptualHasher {
  constructor (prefix = '') {
    this.prefix = prefix
  }

  static IdentifyImage (filename) {
    return new Promise((resolve, reject) => {
      const ps = spawn(
        'convert',
        [
          '-quiet',
          '-limit', 'memory', '4GiB',
          '-moments',
          filename,
          'json:-'
        ])
      let stdout = ''
      let stderr = ''
      ps.stdout.on('data', data => {
        stdout += data
      })
      ps.stderr.on('data', data => {
        stderr += data
      })
      ps.on('close', code => {
        if (code === 0) {
          try {
            // Fun fact. Imagemagick doesn't produce valid json for all file types... Let's clean that up shall we?
            stdout = '[' +
              stdout
                .replace(/␍/gm, '') // We can get embedded carriage return symbols.... why?!
                .trim() // There/s extra whitespace which makes the regexes harder. let's get rid of it.
                .replace(/\b(nan)\b/g, 'null') // (nan) isn't valid in JSON. Null out those fields instead
                .replace(/\s(\+\d+\+\d+)$/gm, '"$1"') // what the even is this!? that's not how you represent strings!
                .replace(/([^,}\][{])($|\n)/g, '$1,$2') // Insert missing commas
                .replace(/,((\s)*[\]}])/g, '$1') // Remove the extra commas at end of arrays/objects we added (TODO: figure out how to not add these in the first place)
                .replace(/^\}\n/gm, '}, \n') + // Add commas between objects (handles gifs which have multiple frames)
              ']'
            return resolve(JSON.parse(stdout))
          } catch (e) {
            console.log(filename)
            reject(e)
          }
        }
        reject(new Error(stderr))
      })
    })
  }

  async GetHash (filename) {
    const startTime = Date.now()
    const fullPath = join(config.imageRoot, this.prefix, filename)
    const pngData = await sharp(fullPath).png().toBuffer()
    const hexHash = (await hash(pngData, 16)).toUpperCase()
    const image = (await PerceptualHasher.IdentifyImage(fullPath))[0].image
    const elapsedTime = (Date.now() - startTime) / 1000
    const extractChannel = channel => [
      +channel.PH1[0], +channel.PH1[1],
      +channel.PH2[0], +channel.PH2[1],
      +channel.PH3[0], +channel.PH3[1],
      +channel.PH4[0], +channel.PH4[1],
      +channel.PH5[0], +channel.PH5[1],
      +channel.PH6[0], +channel.PH6[1],
      +channel.PH7[0], +channel.PH7[1]
    ]
    return {
      filename,
      width: image.geometry.width,
      height: image.geometry.height,
      format: image.format,
      hash: []
        .concat(extractChannel(image.channelPerceptualHash.Channel0 || image.channelPerceptualHash.redHue))
        .concat(extractChannel(image.channelPerceptualHash.Channel1 || image.channelPerceptualHash.greenChroma))
        .concat(extractChannel(image.channelPerceptualHash.Channel2 || image.channelPerceptualHash.blueLuma)),
      filesize: image.filesize,
      elapsedTime,
      hexHash
    }
  }

  CalculateDistance (hashA, hashB) {
    return Math.sqrt(hashA.reduce((acc, val, idx) => acc + ((val - hashB[idx]) * (val - hashB[idx])), 0))
  }
}
exports.PerceptualHasher = PerceptualHasher
