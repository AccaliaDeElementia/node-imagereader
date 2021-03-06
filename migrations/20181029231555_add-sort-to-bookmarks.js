
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('bookmarks', table => {
      table.string('name', 4096)
      table.string('sortKey', 8192)
    })
  ])
}

exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('bookmarks', table => {
      table.dropColumn('name')
      table.dropColumn('sortKey')
    })
  ])
}
