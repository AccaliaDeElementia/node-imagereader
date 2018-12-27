'use sanity'

const Synchronizer = require('./synchronizer')

const fse = require('fs-extra')

const domain = 'https://www.furaffinity.net'
const folderPrefix = 'furaffinity'

const Browser = require('../utils/browser')

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
  const prompt = (question) => new Promise((resolve, reject) => rl.question(question, async (answer) => resolve(answer)))
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

const fetchImage = async ({ browser, logger, user, prefix, id }) => {
  const $ = await browser.fetchCheerio(`${domain}/view/${id}`)
  const imageSrc = $('#submissionImg').data('fullview-src')
  if (!imageSrc) {
    return
  }
  const imageUri = 'https:' + imageSrc
  const title = $('th.cat').text().trim()
  let extension = 'png'
  try {
    extension = /[.]([^.]+)$/.exec(imageUri)[1]
  } catch (e) { }
  const filename = `${title} - ${id}.${extension}`
  const dest = `${prefix}/${filename}`
  logger(`${user} - ${title}`)
  await browser.download(imageUri, dest)
}

const fetchGallery = async ({ db, browser, logger, user, prefix, uri, ids }) => {
  let i = 1
  while (uri) {
    logger(`${prefix} - Page ${i}`)
    const $ = await browser.fetchCheerio(domain + uri)
    const submissions = []
    $('.gallery .t-image b u a').each((_, elem) => {
      const link = $(elem).attr('href')
      const id = /.*\/([0-9]+)\//.exec(link)[1]
      if (!ids[id]) {
        submissions.push(id)
      }
    })
    for (let id of submissions) {
      await fetchImage({ browser, prefix, id, logger, user })
      await db.insert({ submission: id, user, fetched: true }).into('furaffinitysync')
      ids[id] = true
    }
    uri = $('.fancy-pagination .button-link.right').attr('href')
    i++
  }
}

const fetchGalleries = async ({ db, logger, browser, user }) => {
  const idList = await db.select('submission').from('furaffinitysync').where({ user, fetched: true })
  const ids = {}
  idList.forEach(({ submission }) => {
    ids[submission] = true
  })
  const mainGallery = `/gallery/${user}`
  const $ = await browser.fetchCheerio(domain + mainGallery)
  const folders = []
  $('.folder-list a').each((_, elem) => {
    let name = $(elem).text()
    if (name === 'Scraps') {
      return
    }
    const parent = $(elem).closest('ul').prev()
    if (parent.is('h5')) {
      name = `${parent.text()}/${name}`
    }
    folders.push([`${user}/${name}`, $(elem).attr('href')])
  })
  folders.push([user, mainGallery])
  folders.push([`${user}/Scraps`, `/scraps/${user}/`])
  for (let [prefix, uri] of folders) {
    await fetchGallery({ browser, user, prefix, uri, ids, db, logger })
  }
}

const runSync = async (db, logger) => {
  const browser = await new Browser(folderPrefix).prepare()
  const $ = await browser.fetchCheerio(domain)
  const username = $('#my-username').text().trim()

  if (!username) {
    logger('No active login session! Aborting!')
    return false
  }
  const now = Date.now()
  logger('Fur Affinity synchronization begins')
  const watchers = (await db.select().from('furaffinitywatched').where({ active: 1 })).map(u => u.user)
  for (let user of watchers) {
    logger(`Fetching images for ${user}`)
    await fetchGalleries({ browser, user, db, logger })
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
