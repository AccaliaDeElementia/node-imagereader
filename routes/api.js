const express = require('express')

const { posix: { dirname, basename, extname, sep } } = require('path')

const { toSortKey } = require('../utils/utils')

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
  const previousFolder = ((await db('folders')
    .limit(1)
    .select('path')
    .where({ folder: dirname(folder) + sep })
    .andWhere('sortKey', '<', toSortKey(basename(folder)))
    .orderBy('sortKey', 'desc'))[0] || {}).path
  const nextFolder = ((await db('folders')
    .limit(1)
    .select('path')
    .where({ folder: dirname(folder) + sep })
    .andWhere('sortKey', '>', toSortKey(basename(folder)))
    .orderBy('sortKey', 'asc'))[0] || {}).path
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
      seenCount: counts.totalSeen,
      current: firstImage ? '/images' + firstImage : null
    }
  }
  const result = await (getFolder(folder))
  result.previousFolder = previousFolder ? '/show' + previousFolder : null
  result.nextFolder = nextFolder ? '/show' + nextFolder : null
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
  result.folders = folders.filter(f => f.imageCount > 0)
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

async function markRead (db, path, seenValue = true) {
  path = path.replace(/^\/show/, '')
  console.log(path)
  await db('pictures').update({ seen: seenValue }).where('folder', 'like', `${path}%`)
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
  router.post('/mark/read', async (req, res) => {
    await markRead(db, req.body.path, true)
    res.status(200).end()
  })
  router.post('/mark/unread', async (req, res) => {
    await markRead(db, req.body.path, false)
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

module.exports.api = { listing, getBookmarks }
