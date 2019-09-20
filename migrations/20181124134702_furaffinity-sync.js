
exports.up = function (knex) {
  return Promise.all([
    knex.schema.createTable('furaffinitywatched', (table) => {
      table.increments('id').primary()
      table.string('user').unique()
      table.boolean('active').notNullable().defaultTo(true)
    }),
    knex.schema.createTable('furaffinitysync', (table) => {
      table.increments('id').primary()
      table.string('user')
      table.bigInteger('submission')
      table.boolean('fetched').notNullable().defaultTo(false)
    })
  ])
}

exports.down = function (knex) {
  return Promise.all([
    knex.schema.dropTable('furaffinitywatched'),
    knex.schema.dropTable('furaffinitysync')
  ])
}
