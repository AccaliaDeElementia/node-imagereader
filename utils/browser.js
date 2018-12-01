'use sanity'

const config = require('./config')
const { delay } = require('./utils')

const promisify = require('util').promisify
const fse = require('fs-extra')
const { join, dirname } = require('path')

const cheerio = require('cheerio')
const tough = require('tough-cookie')

const useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36'

class Browser {
  constructor (browserName, folderPrefix) {
    this.browserName = browserName
    this.folderPrefix = folderPrefix || browserName
    this.cookiejar = null
    this.rawrequest = null
    this.__request = null
    this.__cookieFile = join(config.imageRoot, '.browsers', `${browserName}.json`)
  }

  async prepare () {
    const r = require('request')
    let toughCookieJar = new tough.CookieJar(undefined, { looseMode: true })
    const jar = r.jar()
    await fse.mkdirp(join(config.imageRoot, '.browsers'))
    try {
      const jarfile = await fse.readJSON(this.__cookieFile)
      toughCookieJar = tough.CookieJar.fromJSON(jarfile)
    } catch (e) { }
    jar._jar = toughCookieJar
    this.rawrequest = r.defaults({
      jar,
      headers: {
        'User-Agent': useragent
      }
    })
    this.__request = promisify(this.rawrequest)
    this.__serializeCookies = promisify(toughCookieJar.serialize.bind(toughCookieJar))
    return this
  }

  async fetch (cfg) {
    const result = await this.__request(cfg)
    await fse.writeJSON(this.__cookieFile, await this.__serializeCookies())
    await delay(500)
    return result
  }

  async fetchCheerio (cfg) {
    const result = await this.fetch(cfg)
    return cheerio.load(result.body)
  }

  async download (uri, dest) {
    dest = join(config.imageRoot, this.folderPrefix, dest)
    await fse.mkdirp(dirname(dest))
    await new Promise((resolve, reject) => {
      const stream = fse.createWriteStream(dest)
      stream.on('error', reject)
      stream.on('finish', resolve)
      this.rawrequest(encodeURI(uri)).pipe(stream)
    })
    await fse.writeJSON(this.__cookieFile, await this.__serializeCookies())
    await delay(500)
  }
}
module.exports = Browser