
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('syncitems', (table) => {
      table.increments('id').primary()
      table.string('folder', 8192)
      table.string('path', 8192)
      table.string('sortKey', 4096)
      table.boolean('isFile').notNullable().defaultTo(false)
      table.index('path')
    })
  ])
}

exports.down = function (knex) {
  return Promise.all([
    knex.schema.dropTable('syncitems')
  ])
}
