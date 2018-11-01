'use strict'

const config = require('./config')
const persistance = require('./persistance')

const debug = require('debug')('imagereader:utils:hentaifoundry')

const promisify = require('util').promisify
const fse = require('fs-extra')
const { join, dirname } = require('path')

const cheerio = require('cheerio')

const domain = 'https://www.hentai-foundry.com'
const folderPrefix = 'hentaifoundry'
const root = config.imageRoot

async function delay (milliseconds = 100) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds / 2 + Math.random() * milliseconds)
  })
}

async function login (request) {
  let req = await request(`${domain}/?enterAgree=1`)
  let $ = cheerio.load(req.body)
  let nonce = $('input[name=YII_CSRF_TOKEN]').val()
  req = await request({
    uri: `${domain}/site/login`,
    method: 'POST',
    formData: {
      YII_CSRF_TOKEN: nonce,
      'LoginForm[username]': config.readValue('HENTAIFOUNDRY_USERNAME'),
      'LoginForm[password]': config.readValue('HENTAIFOUNDRY_PASSWORD'),
      'LoginForm[rememberMe]': '1'
    }
  })
  $ = cheerio.load(req.body)
  nonce = $('input[name=YII_CSRF_TOKEN]').val()
  await request({
    uri: `${domain}`,
    method: 'POST',
    formData: {
      YII_CSRF_TOKEN: nonce,
      'rating_nudity': 3,
      'rating_violence': 3,
      'rating_profanity': 3,
      'rating_racism': 3,
      'rating_sex': 3,
      'rating_spoilers': 3,
      'rating_yaoi': 1,
      'rating_yuri': 1,
      'rating_teen': 1,
      'rating_guro': 1,
      'rating_furry': 1,
      'rating_beast': 1,
      'rating_male': 1,
      'rating_female': 1,
      'rating_futa': 1,
      'rating_other': 1,
      'rating_scat': 1,
      'rating_incest': 1,
      'rating_rape': 1,
      'filter_media': 'A',
      'filter_order': 'date_new',
      'filter_type': 0
    }
  })
  return request(`${domain}/`)
}

const getUserPage = async ({ fetch, user, pageNumber = 1, section = '' }) => {
  const page = await fetch(`${domain}/pictures/user/${user}/${section}/page/${pageNumber}`)
  const $ = cheerio.load(page.body)
  const pictures = $('.thumbTitle a').map((i, e) => e.attribs.href).get()
  if (!pictures.length) {
    return { pictures: [], hasNext: false, totalPictures: 0 }
  }
  const totalPictures = +/of (\d+) result/.exec($('.summary').text())[1]
  const hasNext = !!$('.yiiPager .next:not(.hidden) a').map((i, e) => e.attribs.href).get(0)
  return { pictures, hasNext, totalPictures }
}

const downloadSection = async ({ fetch, download, user, section = '', db, pageLimit = Infinity }) => {
  let pageNumber = 1
  let count = 0
  const idList = await db.select('id').from('hentaifoundrysync').where({ user })
  const idMap = {}
  idList.forEach(({ id }) => {
    idMap[id] = true
  })
  while (pageNumber <= pageLimit) {
    const page = await getUserPage({ fetch, user, section, pageNumber })
    count += page.pictures.length
    debug(`${user} ${section || 'pictures'} - Page ${pageNumber} - Images ${count}/${page.totalPictures}`)
    for (let picture of page.pictures) {
      const id = +(/^\/(?:[^/]+\/){3}([^/]+)\/(.*)$/.exec(picture)[1])
      if (idMap[id]) {
        continue
      }
      const result = await fetch(`${domain}${picture}`)
      const $ = cheerio.load(result.body)
      const title = $('.boxheader .imageTitle').text().replace(/[/?<>\\:*|"^]/g, '-')
      debug(`${id} - ${title}`)
      const link = `https:${$('.boxbody img').attr('src')}`
      const ext = (/[.]([^.]+)$/.exec(link) || [null, 'jpg'])[1]
      const dest = join(user, `${title} - ${id}.${ext}`)
      await download(link, dest)
      await db.insert({ id, user, fetched: true }).into('hentaifoundrysync')
      idMap[id] = true
    }
    if (!page.hasNext) {
      break
    }
    pageNumber++
  }
}

exports.sync = async () => {
  if (!config.readValue('HENTAIFOUNDRY_USERNAME') || !config.readValue('HENTAIFOUNDRY_USERNAME')) {
    debug('No login credentials! Aborting!')
    return
  }
  const rawrequest = require('request').defaults({
    jar: require('request').jar()
  })
  const request = promisify(rawrequest)
  const fetch = (cfg) => request(cfg).then(async (result) => {
    await delay(1000)
    return result
  })
  const download = async (uri, dest) => {
    dest = join(root, folderPrefix, dest)
    await fse.mkdirp(dirname(dest))
    return new Promise((resolve, reject) => {
      const stream = fse.createWriteStream(dest)
      stream.on('error', reject)
      stream.on('finish', resolve)
      rawrequest(uri).pipe(stream)
    })
  }
  await login(fetch)
  const db = await persistance.initialize
  const watchers = (await db.select().from('hentaifoundrywatched').where({ active: 1 })).map(u => u.user)
  for (let user of watchers) {
    await downloadSection({ fetch, download, user, db })
    await downloadSection({ fetch, download, user, section: 'scraps', db })
  }
  return watchers
}
