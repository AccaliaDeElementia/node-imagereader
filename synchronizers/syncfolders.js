'use samity'

const { posix: { basename, dirname, sep } } = require('path')

const config = require('../utils/config')
const fswalker = require('../utils/fswalker')
const { toSortKey } = require('../utils/utils')
const Synchronizer = require('./synchronizer')

const synchronizeDb = async (db, logger) => {
  const now = Date.now()
  logger('picture synchronization begins')
  let dirs = 0
  let files = 0
  await db('syncitems').delete()
  await fswalker(config.imageRoot, async (items, pending) => {
    try {
      await db('syncitems').insert(items.map(item => {
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
      logger(`Found ${dirs} dirs (${pending} pending) and ${files} files`)
    } catch (e) {
      console.error(e, e.stack)
    }
  })
  const insertedpics = await db.from(db.raw('?? (??, ??, ??)', ['pictures', 'folder', 'path', 'sortKey']))
    .insert(function () {
      this.select(['syncitems.folder', 'syncitems.path', 'syncitems.sortKey']).from('syncitems')
        .whereNotExists(function () {
          this.select('*')
            .from('pictures')
            .whereRaw('syncitems.path = pictures.path')
        })
        .andWhere({ 'syncitems.isFile': true })
    })
  logger(`Added ${insertedpics.rowCount} new pictures`)
  const deletedpics = await db('pictures').whereNotExists(function () {
    this.select('*').from('syncitems').whereRaw('syncitems.path = pictures.path')
  }).delete()
  logger(`Removed ${deletedpics} old pictures`)
  const insertedfolders = await db.from(db.raw('?? (??, ??, ??)', ['folders', 'folder', 'path', 'sortKey']))
    .insert(function () {
      this.select(['syncitems.folder', 'syncitems.path', 'syncitems.sortKey']).from('syncitems')
        .whereNotExists(function () {
          this.select('*')
            .from('folders')
            .whereRaw('syncitems.path = folders.path')
        })
        .andWhere({ 'syncitems.isFile': false })
    })
  logger(`Added ${insertedfolders.rowCount} new folders`)
  const deletedfolders = await db('folders').whereNotExists(function () {
    this.select('*').from('syncitems').whereRaw('syncitems.path = folders.path')
  }).delete()
  logger(`Removed ${deletedfolders} old folders`)
  logger(`picture synchronization complete after ${(Date.now() - now) / 1000}s`)
}

module.exports = new Synchronizer({
  name: 'Refresh Folders',
  description: 'Refresh the cache of file system folders and files',
  executor: synchronizeDb,
  runImmediately: true,
  runInterval: 60 * 60 * 1000
})
