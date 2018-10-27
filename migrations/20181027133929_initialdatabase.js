
exports.up = function (knex, Promise) {
  return Promise.all([
    knex.schema.createTable('hentaifoundrywatched', (table) => {
      table.increments('id').primary()
      table.string('user').unique()
      table.boolean('active').notNullable().defaultTo(true)
    }),
    knex.schema.createTable('hentaifoundrysync', (table) => {
      table.increments('id').primary()
      table.string('user')
      table.boolean('fetched').notNullable().defaultTo(false)
    }),
    knex.schema.createTable('pictures', (table) => {
      table.increments('id').primary()
      table.string('folder')
      table.string('path')
      table.integer('checkedAt')
      table.boolean('seen').notNullable().defaultTo(false)
    }),
    knex.schema.createTable('folders', (table) => {
      table.increments('id').primary()
      table.string('folder')
      table.string('path')
      table.string('current')
      table.integer('checkedAt')
      table.boolean('seen').notNullable().defaultTo(false)
    }),
    knex.schema.createTable('bookmarks', (table) => {
      table.increments('id').primary()
      table.string('path')
    })
  ])
}

exports.down = function (knex, Promise) {
}
