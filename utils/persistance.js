const config = require('./config')

const initialize = async () => {
  const dbname = config.readValue('DB_NAME', './mydb.sqlite')
  const knex = require('knex')({
    client: 'sqlite3',
    connection: {
      filename: dbname
    },
    useNullAsDefault: true
  })
  for (let i = 0; i < tables.length; i++) {
    const [name, creator] = tables[i]

    const exists = await knex.schema.hasTable(name)
    if (!exists) {
      await knex.schema.createTable(name, creator)
    }
  }
  return knex
}

const tables = [
  ['hentaifoundrywatched', (table) => {
    table.increments('id').primary()
    table.string('user').unique()
    table.boolean('active').notNullable().defaultTo(true)
  }],
  ['hentaifoundrysync', (table) => {
    table.increments('id').primary()
    table.string('user')
    table.boolean('fetched').notNullable().defaultTo(false)
  }],
  ['pictures', (table) => {
    table.increments('id').primary()
    table.string('folder')
    table.string('path')
    table.integer('checkedAt')
    table.boolean('seen').notNullable().defaultTo(false)
  }],
  ['folders', (table) => {
    table.increments('id').primary()
    table.string('folder')
    table.string('path')
    table.string('current')
    table.integer('checkedAt')
    table.boolean('seen').notNullable().defaultTo(false)
  }],
  ['bookmarks', (table) => {
    table.increments('id').primary()
    table.string('path')
  }]
]

exports.initialize = initialize()
