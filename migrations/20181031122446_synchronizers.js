
exports.up = function (knex) {
  return knex.schema.createTable('synchronizers', (table) => {
    table.increments('id').primary()
    table.string('name', 255)
    table.string('description', 8192)
    table.string('outputTail', 8192)
    table.bigInteger('lastRunStart').notNullable().defaultTo(0)
    table.bigInteger('lastRunEnd').notNullable().defaultTo(0)
    table.boolean('runImmediately').notNullable().defaultTo(false)
    table.boolean('isEnabled').notNullable().defaultTo(true)
    table.boolean('useJitter').notNullable().defaultTo(false)
    table.double('jitterFactor').notNullable().defaultTo(0.5)
    table.integer('runInterval').notNullable().defaultTo(24 * 60 * 60 * 1000)
  })
}

exports.down = function (knex) {
  return knex.schema.dropTable('synchronizers')
}
