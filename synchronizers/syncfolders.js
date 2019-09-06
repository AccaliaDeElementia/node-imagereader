'use samity'

const { posix: { basename, dirname, sep } } = require('path')

const config = require('../utils/config')
const fswalker = require('../utils/fswalker')
const { toSortKey } = require('../utils/utils')
const Synchronizer = require('./synchronizer')

const chunk = (arr, size = 200) => {
  const res = []
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size))
  }
  return res
}

const resetStaging = async (db) => {
  await db.schema.dropTableIfExists('syncitems')
  await db.schema.createTable('syncitems', (table) => {
    table.increments('id').primary()
    table.string('folder', 8192)
    table.string('path', 8192)
    table.string('sortKey', 4096)
    table.boolean('isFile').notNullable().defaultTo(false)
    table.index('path')
  })
}

const synchronizeDb = async (db, logger) => {
  await resetStaging(db)
  const now = Date.now()
  logger('picture synchronization begins')
  let dirs = 0
  let files = 0
  await db('syncitems').delete()
  await fswalker(config.imageRoot, async (items, pending) => {
    try {
      const chunks = chunk(items)
      for (const chunk of chunks) {
        await db('syncitems').insert(chunk.map(item => {
          if (item.isFile) {
            files++
          } else {
            dirs++
          }
          let folder = dirname(item.path)
          if (folder.length > 1) {
            folder += sep
          }
          return {
            folder: folder,
            path: item.path + (!item.isFile ? sep : ''),
            isFile: item.isFile,
            sortKey: toSortKey(basename(item.path))
          }
        }))
      }
      logger(`Found ${dirs} dirs (${pending} pending) and ${files} files`)
    } catch (e) {
      console.error(e, e.stack)
    }
  })
  const insertedpics = await db.from(db.raw('?? (??, ??, ??)', ['pictures', 'folder', 'path', 'sortKey']))
    .insert(function () {
      this.select(['syncitems.folder', 'syncitems.path', 'syncitems.sortKey']).from('syncitems')
        .leftJoin('pictures', 'pictures.path', 'syncitems.path')
        .andWhere({
          'syncitems.isFile': true,
          'pictures.path': null
        })
    })
  logger(`Added ${insertedpics.rowCount} new pictures`)
  const deletedpics = await db('pictures').whereNotExists(function () {
    this.select('*').from('syncitems').whereRaw('syncitems.path = pictures.path')
  }).delete()
  logger(`Removed ${deletedpics} old pictures`)
  const insertedfolders = await db.from(db.raw('?? (??, ??, ??)', ['folders', 'folder', 'path', 'sortKey']))
    .insert(function () {
      this.select(['syncitems.folder', 'syncitems.path', 'syncitems.sortKey']).from('syncitems')
        .leftJoin('folders', 'folders.path', 'syncitems.path')
        .andWhere({
          'syncitems.isFile': false,
          'folders.path': null
        })
    })
  logger(`Added ${insertedfolders.rowCount} new folders`)
  const deletedfolders = await db('folders').whereNotExists(function () {
    this.select('*').from('syncitems').whereRaw('syncitems.path = folders.path')
  }).delete()
  logger(`Removed ${deletedfolders} old folders`)
  const removedCoverImages = await db('folders')
    .update({ current: '' })
    .whereNotExists(function () {
      this.select('*')
        .from('pictures')
        .whereRaw('pictures.path = folders.current')
    })
    .whereRaw('folders.current <> \'\'')
  logger(`Removed ${removedCoverImages} missing cover images`)
  const removedBookmarks = await db('bookmarks')
    .whereNotExists(function () {
      this.select('*')
        .from('pictures')
        .whereRaw('pictures.path = bookmarks.path')
    })
    .delete()
  logger(`Removed ${removedBookmarks} missing bookmarks`)
  logger(`picture synchronization complete after ${(Date.now() - now) / 1000}s`)
}

module.exports = new Synchronizer({
  name: 'Refresh Folders',
  description: 'Refresh the cache of file system folders and files',
  executor: synchronizeDb,
  runImmediately: true,
  runInterval: 60 * 60 * 1000
})
