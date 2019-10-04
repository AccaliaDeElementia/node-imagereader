'use sanity'

const config = require('./config')

const { spawn } = require('child_process')

const { join } = require('path')

const { hash } = require('imghash')
const sharp = require('sharp')

const JSON5 = require('json5')

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
          '-limit', 'thread', '12',
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
        if (stdout.length > 0) {
          try {
            // Fun fact. Imagemagick doesn't produce valid json for all file types... Let's clean that up shall we?
            stdout = '[' +
              stdout
                .replace(/␍/gm, '') // We can get embedded carriage return symbols.... why?!
                .replace(/^\s+$/gm, '') // There/s extra whitespace which makes the regexes harder. let's get rid of it.
                .replace(/\b(nan)\b/g, 'null') // (nan) isn't valid in JSON. Null out those fields instead
                .replace(/\s(\+\d+\+\d+)$/gm, '"$1"') // what the even is this!? that's not how you represent strings!
                .replace(/(\d|")$/gm, '$1,') // add commas to the end of fields
                .replace(/^}$/gm, '},') + // add commas between frames
              ']'
            return resolve(JSON5.parse(stdout))
          } catch (e) {
            if (code === 0) {
              reject(e)
            } else {
              reject(new Error(stderr))
            }
          }
        }
        reject(new Error(stderr || 'No Ouptut Detected'))
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
      hexHashA: hexHash.substring(0, 4),
      hexHashB: hexHash.substring(4, 8),
      hexHashC: hexHash.substring(8, 12),
      hexHashD: hexHash.substring(12, 16)
    }
  }

  CalculateDistance (hashA, hashB) {
    return Math.sqrt(hashA.reduce((acc, val, idx) => acc + ((val - hashB[idx]) * (val - hashB[idx])), 0))
  }
}
exports.PerceptualHasher = PerceptualHasher
