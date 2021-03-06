'use sanity'

const Synchronizer = require('./synchronizer')

const fse = require('fs-extra')

const domain = 'https://www.furaffinity.net'
const folderPrefix = 'furaffinity'

const Browser = require('../utils/browser')
const { toFolderName } = require('../utils/utils.js')

const cloudscraper = require('cloudscraper')
const cheerio = require('cheerio')

const login = async () => {
  const browser = await new Browser(folderPrefix).prepare()
  let $ = await browser.fetchCheerio(`${domain}/login/?mode=imagecaptcha`)
  const captchaLink = $('#captcha_img').attr('src')
  await new Promise((resolve, reject) => {
    const stream = fse.createWriteStream('./captcha.jpg')
    stream.on('error', reject)
    stream.on('finish', resolve)
    browser.rawrequest(`${domain}${captchaLink}`).pipe(stream)
  })
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })
  const prompt = (question) => new Promise((resolve) => rl.question(question, async (answer) => resolve(answer)))
  const captcha = await prompt('Captcha Result: ')
  const username = await prompt('Username: ')
  const password = await prompt('Password: ')
  rl.close()
  await browser.fetch({
    uri: 'https://www.furaffinity.net/login/?ref=https://www.furaffinity.net/login/',
    method: 'POST',
    formData: {
      action: 'login',
      name: username,
      pass: password,
      'g-recaptcha-response': '',
      use_old_captcha: 1,
      captcha: captcha,
      login: 'Login to FurAffinity'
    }
  })
  $ = await browser.fetchCheerio(domain)
  console.log($('#my-username').text())
}

const fetchImage = async ({ browser, logger, user, id }) => {
  const $ = cheerio.load(await cloudscraper({
    jar: browser.cookiejar,
    uri: `${domain}/view/${id}`
  }))
  const folder = $('.folder-list-container div:first-of-type a *').map((_, e) => $(e).text().trim()).get().join('/')
  const imageSrc = $('#submissionImg').data('fullview-src')
  if (!imageSrc) {
    return
  }
  const imageUri = 'https:' + imageSrc
  const title = $('.submission-title').text().trim()
  let extension = 'png'
  try {
    extension = /[.]([^.]+)$/.exec(imageUri)[1]
  } catch (e) { }
  const filename = `${toFolderName(title)} - ${id}.${extension}`
  const dest = `${user}/${folder}/${filename}`.replace(/\/\/+/g, '/')
  logger(`${user}- ${folder} - ${title}`)
  await browser.download(imageUri, dest)
  const description = $('.submission-description').html()
  if (description && description.length > 0) {
    await browser.saveText(`<div>\n${description}\n</div>`, `${dest}.txt`)
  }
}

const fetchGallery = async ({ db, browser, logger, user, fetchedAll, prefix, uri, ids }) => {
  let i = 1
  while (uri) {
    logger(`${prefix} - Page ${i}`)
    const $ = cheerio.load(await cloudscraper({
      jar: browser.cookiejar,
      uri: domain + uri
    }))
    const submissions = []
    $('.gallery .t-image b u a').each((_, elem) => {
      const link = $(elem).attr('href')
      const id = /.*\/([0-9]+)\//.exec(link)[1]
      if (!ids[id]) {
        submissions.push(id)
      }
    })
    if (fetchedAll && submissions.length === 0) {
      break
    }
    for (const id of submissions) {
      await fetchImage({ browser, id, logger, user })
      for (let i = 1; i <= 5; i++) {
        try {
          await db.insert({ submission: id, user, fetched: true }).into('furaffinitysync')
          break
        } catch (e) {
          logger(`Error Syncing id ${id}, Try ${i}/5`)
        }
      }
      ids[id] = true
    }
    uri = $('form:has(button:contains(Next))').attr('action')
    i++
  }
}

const fetchGalleries = async ({ db, logger, browser, user, fetchedAll }) => {
  const idList = await db.select('submission').from('furaffinitysync').where({ user, fetched: true })
  const ids = {}
  idList.forEach(({ submission }) => {
    ids[submission] = true
  })
  const mainGallery = `/gallery/${user}`
  const folders = []
  folders.push([user, mainGallery])
  folders.push([`${user}/Scraps`, `/scraps/${user}/`])
  for (const [prefix, uri] of folders) {
    await fetchGallery({ browser, user, fetchedAll, prefix, uri, ids, db, logger })
  }
}

const runSync = async (db, logger) => {
  const browser = await new Browser(folderPrefix).prepare()
  const $ = cheerio.load(await cloudscraper({
    jar: browser.cookiejar,
    uri: domain
  }))
  const username = $('#my-username').text().trim()
  if (!username) {
    logger('No active login session! Aborting!')
    return false
  }
  const now = Date.now()
  logger('Fur Affinity synchronization begins')
  const watchers = (await db.select().from('furaffinitywatched').where({ active: 1 }))
  for (const { user, fetchedAll } of watchers) {
    logger(`Fetching images for ${user}`)
    await fetchGalleries({ browser, user, fetchedAll, db, logger })
    await db('furaffinitywatched').update({ fetchedAll: true }).where({ user: user })
  }
  logger(`Fur Affinity synchronization complete after ${(Date.now() - now) / 1000}s`)
  return true
}

if (require.main === module) {
  login()
} else {
  module.exports = new Synchronizer({
    name: 'Sync Fur Affinity [dot] net',
    description: 'Fetch new images from watched artists at Fur Affinity [dot] net',
    executor: runSync,
    runImmediately: false,
    runInterval: 24 * 60 * 60 * 1000,
    useJitter: true
  })
}
