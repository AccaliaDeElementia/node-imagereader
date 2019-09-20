
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('pictures', table => {
      table.string('sortKey', 4096)
    }),
    knex.schema.table('folders', table => {
      table.string('sortKey', 4096)
    })
  ])
}

exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('pictures', table => {
      table.dropColumn('sortKey')
    }),
    knex.schema.table('folders', table => {
      table.dropColumn('sortKey')
    })
  ])
}
