'use sanity'

const Synchronizer = require('./synchronizer')

const Browser = require('../utils/browser')
const config = require('../utils/config')
const { join } = require('path')

const cheerio = require('cheerio')

const domain = 'https://www.hentai-foundry.com'
const folderPrefix = 'hentaifoundry'

async function login (browser, logger) {
  let req = await browser.fetch(`${domain}/?enterAgree=1`)
  let $ = cheerio.load(req.body)
  const welcomeMessage = $('#headerWelcome')
  if (welcomeMessage.length) {
    logger('Already Logged In')
    return req
  }
  logger('Logging In')
  let nonce = $('input[name=YII_CSRF_TOKEN]').val()
  req = await browser.fetch({
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
  await browser.fetch({
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
  return browser.fetch(`${domain}/`)
}

const getUserPage = async ({ browser, user, pageNumber = 1, section = '' }) => {
  const page = await browser.fetch(`${domain}/pictures/user/${user}/${section}/page/${pageNumber}`)
  const $ = cheerio.load(page.body)
  const pictures = $('.thumbTitle a').map((i, e) => e.attribs.href).get()
  if (!pictures.length) {
    return { pictures: [], hasNext: false, totalPictures: 0 }
  }
  const totalPictures = +/of (\d+) result/.exec($('.summary').text())[1]
  const hasNext = !!$('.yiiPager .next:not(.hidden) a').map((i, e) => e.attribs.href).get(0)
  return { pictures, hasNext, totalPictures }
}

const downloadSection = async ({ browser, user, section = '', db, pageLimit = Infinity, logger }) => {
  let pageNumber = 1
  let count = 0
  const idList = await db.select('id').from('hentaifoundrysync').where({ user })
  const idMap = {}
  idList.forEach(({ id }) => {
    idMap[id] = true
  })
  while (pageNumber <= pageLimit) {
    const page = await getUserPage({ browser, user, section, pageNumber })
    count += page.pictures.length
    logger(`${user} ${section || 'pictures'} - Page ${pageNumber} - Images ${count}/${page.totalPictures}`)
    for (let picture of page.pictures) {
      const id = +(/^\/(?:[^/]+\/){3}([^/]+)\/(.*)$/.exec(picture)[1])
      if (idMap[id]) {
        continue
      }
      const result = await browser.fetch(`${domain}${picture}`)
      const $ = cheerio.load(result.body)
      const title = $('.boxheader .imageTitle').text().replace(/[/?<>\\:*|"^]/g, '-')
      logger(`${id} - ${title}`)
      const link = `https:${$('.boxbody img').attr('src')}`
      const ext = (/[.]([^.]+)$/.exec(link) || [null, 'jpg'])[1]
      const dest = join(user, `${title} - ${id}.${ext}`)
      await browser.download(link, dest)
      await db.insert({ id, user, fetched: true }).into('hentaifoundrysync')
      idMap[id] = true
    }
    if (!page.hasNext) {
      break
    }
    pageNumber++
  }
}

const runSync = async (db, logger) => {
  const now = Date.now()
  if (!config.readValue('HENTAIFOUNDRY_USERNAME') || !config.readValue('HENTAIFOUNDRY_PASSWORD')) {
    logger('No login credentials! Aborting!')
    return
  }
  logger('hentaifoundry synchronization begins')
  const browser = await new Browser(folderPrefix).prepare()

  await login(browser, logger)
  const watchers = (await db.select().from('hentaifoundrywatched').where({ active: 1 })).map(u => u.user)
  for (let user of watchers) {
    await downloadSection({ browser, user, db, logger })
    await downloadSection({ browser, user, section: 'scraps', db, logger })
  }
  logger(`hentaifoundry synchronization complete after ${(Date.now() - now) / 1000}s`)
}

module.exports = new Synchronizer({
  name: 'Sync Hentaifoundry',
  description: 'Fetch new images from watched artists at Hentaifoundry',
  executor: runSync,
  runImmediately: false,
  runInterval: 24 * 60 * 60 * 1000,
  useJitter: true
})
