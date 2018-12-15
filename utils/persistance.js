const config = require('./config')

const initialize = async () => {
  const environment = config.readValue('DB_ENVIRONMENT', 'development')
  const connection = require('../knexfile.js')[environment]
  const knex = require('knex')(connection)
  await knex.migrate.latest()
  return knex
}

exports.initialize = initialize()
