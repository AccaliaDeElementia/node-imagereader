
exports.up = function (knex) {
  return Promise.all([
    knex.schema.table('hentaifoundrywatched', table => {
      table.boolean('fetchedAll')
    }),
    knex.schema.table('furaffinitywatched', table => {
      table.boolean('fetchedAll')
    })
  ])
}

exports.down = function (knex) {
  return Promise.all([
    knex.schema.table('hentaifoundrywatched', table => {
      table.dropColumn('fetchedAll')
    }),
    knex.schema.table('furaffinitywatched', table => {
      table.dropColumn('fetchedAll')
    })
  ])
}
