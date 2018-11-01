const express = require('express')

const config = require('../utils/config')
const fswalker = require('../utils/fswalker')
const { posix: { dirname, basename, extname, sep } } = require('path')

const debug = require('debug')('imagereader:routes:pictures')

const toSortKey = path => {
  const name = basename(path)
  const base = '0'.repeat(30)
  return name.toLowerCase().replace(/(\d+)/g, num => `${base}${num}`.slice(-30))
}

// TODO: this really doesn't belong in api now does it?
const synchronizeDb = async (db) => {
  const checkedAt = Date.now()
  debug('picture synchronization begins')
  let count = 0
  let dirs = 0
  let files = 0
  await fswalker(config.imageRoot, async ({ path, isFile }) => {
    try {
      count++
      if (isFile) {
        files++
      } else {
        dirs++
      }
      if (!isFile && path[path.length - 1] !== sep) {
        path += sep
      }
      let folder = dirname(path)
      if (folder[folder.length - 1] !== sep) {
        folder += sep
      }
      const dest = isFile ? 'pictures' : 'folders'
      const sortKey = toSortKey(path)
      const result = await db(dest).update({ checkedAt, sortKey }).where({ path })
      if (result === 0) {
        await db(dest).insert({ checkedAt, path, folder, sortKey })
      }
      if (count % 20 === 0) {
        debug(`Found ${dirs} dirs and ${files} files`)
      }
    } catch (e) {
      console.error(e, e.stacktrace)
    }
  })
  await db('pictures').delete().whereNot({ checkedAt })
  await db('folders').delete().whereNot({ checkedAt })
  debug('picture synchronization complete')
}

async function listing (db, folder, recurse = true) {
  if (folder[folder.length - 1] !== sep) {
    folder += sep
  }
  const folderInfoSubQuery = db('pictures')
    .select('folder')
    .count('* as totalCount')
    .sum({ totalSeen: db.raw('CASE WHEN seen THEN 1 ELSE 0 END') })
    .min('sortKey as firstImage')
    .groupBy('folder')
    .where('folder', 'like', `${folder}%`)
    .as('folderInfos')
  const folderInfos = await db('pictures')
    .select(
      'pictures.folder as folder',
      'pictures.path as firstImage',
      'folderInfos.totalCount as totalCount',
      'folderInfos.totalSeen as totalSeen')
    .join(folderInfoSubQuery, function () {
      this.on('folderInfos.firstImage', '=', 'pictures.sortKey')
        .andOn('folderInfos.folder', '=', 'pictures.folder')
    })
  const getFolder = async path => {
    const folderInfo = (await db('folders').select(['path', 'current']).where({ path }))[0] || {}
    const counts = folderInfos
      .filter(i => i.folder.substring(0, path.length) === path)
      .reduce((accumulator, current) => {
        accumulator.totalSeen += +current.totalSeen
        accumulator.totalCount += +current.totalCount
        if (current.folder === path) {
          accumulator.firstImage = current.firstImage
        }
        return accumulator
      },
      {
        totalSeen: 0,
        totalCount: 0,
        firstImage: null
      })
    const firstImage = folderInfo.current ? folderInfo.current : counts.firstImage
    return {
      path: '/show' + path,
      name: basename(path),
      parent: dirname(path + sep),
      percent: counts.totalSeen / counts.totalCount * 100,
      imageCount: counts.totalCount,
      current: firstImage ? '/images' + firstImage : null
    }
  }
  const result = await (getFolder(folder))
  let folders = []
  if (recurse) {
    for (let dir of await db('folders').select(['path', 'current']).where({ folder }).orderBy('sortKey')) {
      folders.push(await getFolder(dir.path))
    }
  }
  let pictures = await db('pictures').select(['path', 'seen']).where({ folder }).orderBy('sortKey')
  pictures.forEach(picture => {
    picture.name = basename(picture.path, extname(picture.path))
    picture.path = '/images' + picture.path
  })
  result.folders = folders
  result.pictures = pictures
  return result
}

async function setLatest (db, path) {
  path = path.replace(/^\/images/, '')
  const folder = dirname(path) + sep
  await db('folders').update({ current: path }).where({ path: folder })
  await db('pictures').update({ seen: true }).where({ path })
}

async function getBookmarks (db) {
  let bookmarks = await db('bookmarks').select(['id', 'path', 'name']).orderBy('sortKey')
  bookmarks = bookmarks.map(bookmark => {
    return {
      link: `/api/bookmarks/${bookmark.id}`,
      path: '/images' + bookmark.path,
      name: bookmark.name
    }
  })
  return bookmarks
}

async function addBookmark (db, path) {
  path = path.replace(/^\/images/, '')
  const bookmark = await db('bookmarks').select('id').where({ path })[0]
  if (!bookmark) {
    const name = `${basename(dirname(path))} - ${basename(path, extname(path))}`
    const sortKey = toSortKey(name)
    await db('bookmarks').insert({ path, name, sortKey })
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

  return router
}

module.exports.api = { listing, getBookmarks, synchronizeDb }
