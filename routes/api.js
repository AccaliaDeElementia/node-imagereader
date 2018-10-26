const express = require('express')

const { delay } = require('../utils/utils')
const config = require('../utils/config')
const fswalker = require('../utils/fswalker')
const { posix: { dirname, basename, extname, sep } } = require('path')

const debug = require('debug')('picturereader:routes:pictures')

const naturalOrder = (list, keyExtractor = key => key, numberExtendTo = 20) => {
  const base = '0'.repeat(numberExtendTo)
  list.forEach(item => {
    item.__key = `${keyExtractor(item)}`.replace(/(\d+)/g, num => `${base}${num}`.slice(-numberExtendTo))
  })
  list.sort((a, b) => {
    if (a.__key < b.__key) {
      return -1
    } else if (a.__key > b.__key) {
      return 1
    }
    return 0
  })
  list.forEach(item => {
    delete item.__key
  })
  return list
}

const synchronizeDb = async (db) => {
  const checkedAt = Date.now()
  debug('picture synchronization begins')
  await fswalker(config.imageRoot, async ({ path, isFile }) => {
    try {
      if (!isFile && path[path.length - 1] !== sep) {
        path += sep
      }
      let folder = dirname(path)
      if (folder[folder.length - 1] !== sep) {
        folder += sep
      }
      const dest = isFile ? 'pictures' : 'folders'
      const result = await db(dest).update({ checkedAt }).where({ path })
      if (result === 0) {
        debug(`found NEW ${isFile ? 'file' : 'directory'} : {${path}}`)
        await db(dest).insert({ checkedAt, path, folder })
      } else {
        debug(`found ${isFile ? 'file' : 'directory'} : {${path}}`)
      }
    } catch (e) {
      console.error(e, e.stacktrace)
    }
    await delay()
  })
  await db('pictures').delete().whereNot({ checkedAt })
  await db('folders').delete().whereNot({ checkedAt })
  debug('picture synchronization complete')
}

async function listing (db, folder, recurse = true) {
  if (folder[folder.length - 1] !== sep) {
    folder += sep
  }
  const imageCount = (await db('pictures').count('id as total').where('folder', 'like', `${folder}%`))[0].total
  const seenImages = (await db('pictures').count('id as total').where('folder', 'like', `${folder}%`).where({ seen: true }))[0].total
  const folderInfo = (await db('folders').select(['path', 'current']).where({ path: folder }))[0] || {}
  let folders = []
  if (recurse) {
    for (let dir of await db('folders').select(['path', 'current']).where({ folder })) {
      folders.push(await listing(db, dir.path, false))
    }
    folders = naturalOrder(folders, i => i.name.toLowerCase())
  }
  let pictures = await db('pictures').select(['path', 'seen']).where({ folder })
  pictures.forEach(picture => {
    picture.name = basename(picture.path, extname(picture.path))
    picture.path = '/images' + picture.path
  })
  pictures = naturalOrder(pictures, i => i.name.toLowerCase())
  const result = {
    path: '/show' + folder,
    name: basename(folder),
    parent: dirname(folder + sep),
    percent: seenImages / imageCount * 100,
    current: folderInfo.current ? '/images' + folderInfo.current : (pictures[0] || {}).path
  }
  if (recurse) {
    result.folders = folders
    result.pictures = pictures
  }
  return result
}

async function setLatest (db, path) {
  path = path.replace(/^\/images/, '')
  const folder = dirname(path) + sep
  await db('folders').update({ current: path }).where({ path: folder })
}

async function getBookmarks (db) {
  let bookmarks = await db('bookmarks').select(['id', 'path'])
  bookmarks = bookmarks.map(bookmark => {
    const folder = basename(dirname(bookmark.path))
    const name = basename(bookmark.path, extname(bookmark.path))
    return {
      link: `/api/bookmarks/${bookmark.id}`,
      path: '/images' + bookmark.path,
      name: `${folder} - ${name}`
    }
  })
  bookmarks = naturalOrder(bookmarks, i => i.name.toLowerCase())
  return bookmarks
}

async function addBookmark (db, path) {
  path = path.replace(/^\/images/, '')
  const bookmark = await db('bookmarks').select('id').where({ path })[0]
  if (!bookmark) {
    await db('bookmarks').insert({ path })
  }
}

async function deleteBookmark (db, id) {
  await db('bookmarks').delete().where({ id })
}

async function goToBookmark (db, id) {
  const bookmark = await db('bookmarks').select('path').where({ id })
  await setLatest(db, bookmark[0].path)
  return '/show' + dirname(bookmark[0].path)
}

module.exports = (db) => {
  const router = express.Router()

  router.get('/', async (req, res) => {
    const image = await db('pictures').select('path').orderBy(db.raw('RANDOM()')).limit(1)
    res.render('index', { image: '/images' + image[0].path })
  })
  router.get('/listing/*', async (req, res) => {
    let folder = '/' + (req.params[0] || '')
    res.json(await listing(db, folder))
  })
  router.post('/navigate/latest', async (req, res) => {
    await setLatest(db, req.body.path)
    res.status(200).end()
  })
  router.get('/bookmarks', async (req, res) => {
    res.json(await getBookmarks(db))
  })
  router.post('/bookmarks/add', async (req, res) => {
    await addBookmark(db, req.body.path)
    res.status(200).end()
  })
  router.delete('/bookmarks/:id', async (req, res) => {
    await deleteBookmark(db, req.params.id)
    res.status(200).end()
  })
  router.get('/bookmarks/:id', async (req, res) => {
    res.redirect(await goToBookmark(db, req.params.id))
  })

  const oneHour = 60 * 60 * 1000
  setInterval(() => synchronizeDb(db), oneHour)
  synchronizeDb(db)

  return router
}

module.exports.api = { listing, getBookmarks }
