const { toSortKey } = require('../utils/utils')
const { posix: { basename } } = require('path')

function updateFolder (folder, knex, Promise, getSortKey) {
  return knex(folder)
    .select('id', 'path')
    .then(items => {
      const runPart = () => Promise.resolve()
        .then(() => {
          if (items.length > 0) {
            const item = items.pop()
            return knex('pictures')
              .where({ id: item.id })
              .update({
                sortKey: getSortKey(item)
              })
          }
          return Promise.resolve()
        })
        .then(() => items.length > 0 ? runPart() : Promise.resolve())
      return runPart()
    })
}

exports.up = function (knex, Promise) {
  return Promise.all([
    updateFolder('pictures', knex, Promise, folder => toSortKey(basename(folder.path), 2)),
    updateFolder('folders', knex, Promise, folder => toSortKey(basename(folder.path), 2))
  ])
}

exports.down = function (knex, Promise) {
  return Promise.all([
    updateFolder('pictures', knex, Promise, folder => toSortKey(basename(folder.path), 1)),
    updateFolder('folders', knex, Promise, folder => toSortKey(basename(folder.path), 1))
  ])
}
