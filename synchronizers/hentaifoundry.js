'use sanity'

const Synchronizer = require('./synchronizer')

const Browser = require('../utils/browser')
const config = require('../utils/config')
const { toFolderName } = require('../utils/utils')
const { join } = require('path')

const cheerio = require('cheerio')

const domain = 'https://www.hentai-foundry.com'
const folderPrefix = 'hentaifoundry'

async function checkLogin (browser, logger) {
  const req = await browser.fetch(`${domain}/?enterAgree=1`)
  const $ = cheerio.load(req.body)
  const welcomeMessage = $('#headerWelcome')
  if (welcomeMessage.length) {
    logger('Already Logged In')
    return true
  }
  return false
}

async function login (browser, logger) {
  let req = await browser.fetch(`${domain}/?enterAgree=1`)
  let $ = cheerio.load(req.body)
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
      rating_nudity: 3,
      rating_violence: 3,
      rating_profanity: 3,
      rating_racism: 3,
      rating_sex: 3,
      rating_spoilers: 3,
      rating_yaoi: 1,
      rating_yuri: 1,
      rating_teen: 1,
      rating_guro: 1,
      rating_furry: 1,
      rating_beast: 1,
      rating_male: 1,
      rating_female: 1,
      rating_futa: 1,
      rating_other: 1,
      rating_scat: 1,
      rating_incest: 1,
      rating_rape: 1,
      filter_media: 'A',
      filter_order: 'date_new',
      filter_type: 0
    }
  })
  return browser.fetch(`${domain}/`)
}

const getUserPage = async ({ browser, user, pageNumber = 1, section = '' }) => {
  const page = await browser.fetch(`${domain}/pictures/user/${user}/${section}/page/${pageNumber}`)
  const $ = cheerio.load(page.body)
  const pictures = $('.thumbTitle a').map((_, e) => e.attribs.href).get().map(p => {
    return {
      picture: p,
      id: +(/^\/(?:[^/]+\/){3}([^/]+)\/(.*)$/.exec(p)[1])
    }
  })
  if (!pictures.length) {
    return { pictures: [], hasNext: false, totalPictures: 0 }
  }
  const totalPictures = +/of (\d+) result/.exec($('.summary').text())[1]
  const hasNext = !!$('.yiiPager .next:not(.hidden) a').map((_, e) => e.attribs.href).get(0)
  return { pictures, hasNext, totalPictures }
}

const downloadSection = async ({ browser, user, section = '', db, pageLimit = Infinity, logger, fetchedAll }) => {
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
    const pictures = page.pictures.filter(p => !idMap[p.id])
    if (fetchedAll && pictures.length === 0) {
      break
    }
    for (const { picture, id } of pictures) {
      const result = await browser.fetch(`${domain}${picture}`)
      const $ = cheerio.load(result.body)
      const title = $('.boxheader .imageTitle').text().replace(/[/?<>\\:*|"^]/g, '-')
      logger(`${id} - ${title}`)
      const link = `https:${$('.boxbody img').attr('src')}`
      const ext = (/[.]([^.]+)$/.exec(link) || [null, 'jpg'])[1]
      const dest = join(user, `${toFolderName(title)} - ${id}.${ext}`)
      await browser.download(link, dest)
      const description = $('.picDescript').html()
      if (description && description.length > 0) {
        await browser.saveText(`<div>\n${description}\n</div>`, `${dest}.txt`)
      }
      for (let i = 1; i <= 5; i++) {
        try {
          await db.insert({ id, user, fetched: true }).into('hentaifoundrysync')
          break
        } catch (e) {
          logger(`Error Syncing id ${id}, Try ${i}/5`)
        }
      }
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
  const browser = await new Browser(folderPrefix).prepare()
  if (!await checkLogin(browser, logger)) {
    if (!config.readValue('HENTAIFOUNDRY_USERNAME') || !config.readValue('HENTAIFOUNDRY_PASSWORD')) {
      logger('No login credentials! Cannot Auto Login!')
      return false
    }
    await login(browser, logger)
  }
  logger('hentaifoundry synchronization begins')
  const watchers = (await db.select().from('hentaifoundrywatched').where({ active: 1 }))
  for (const { user, fetchedAll } of watchers) {
    await downloadSection({ browser, user, db, logger, fetchedAll })
    await downloadSection({ browser, user, section: 'scraps', db, logger, fetchedAll })
    await db('hentaifoundrywatched').update({ fetchedAll: true }).where({ user: user })
  }
  logger(`hentaifoundry synchronization complete after ${(Date.now() - now) / 1000}s`)
  return true
}

module.exports = new Synchronizer({
  name: 'Sync Hentaifoundry',
  description: 'Fetch new images from watched artists at Hentaifoundry',
  executor: runSync,
  runImmediately: false,
  runInterval: 24 * 60 * 60 * 1000,
  useJitter: true
})
