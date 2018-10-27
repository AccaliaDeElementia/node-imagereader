const config = require('./config')

const initialize = async () => {
  const environment = config.readValue('DB_ENVIRONMENT', 'development')
  const connection = require('../knexfile.js')[environment]
  const dbname = config.readValue('DB_NAME', './mydb.sqlite')
  connection.connection.filename = dbname
  const knex = require('knex')(connection)
  await knex.migrate.latest()
  return knex
}

exports.initialize = initialize()
