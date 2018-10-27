// Update with your config settings.

module.exports = {

  development: {
    client: 'sqlite3',
    connection: {
      filename: './mydb.sqlite',
      database: 'imagereader',
      user: 'postgres',
      password: 'my_postgres_password'
    },
    useNullAsDefault: true
  },

  production: {
    client: 'postgresql',
    connection: {
      database: 'imagereader',
      user: 'postgres',
      password: 'my_postgres_password'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }
}
