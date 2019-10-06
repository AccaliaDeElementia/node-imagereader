
exports.up = function (knex) {
  return knex.schema.alterTable('perceptualFingerprint', table => {
    ['hexHashA', 'hexHashB', 'hexHashC', 'hexHashD'].forEach(i => table.index(i))
  })
    .then(() => knex.schema.alterTable('hashPattern', table => {
      table.index('pattern')
    }))
}

exports.down = function (knex) {
  return knex.schema.alterTable('perceptualFingerprint', table => {
    ['hexHashA', 'hexHashB', 'hexHashC', 'hexHashD'].forEach(i => table.dropIndex(i))
  })
    .then(() => knex.schema.alterTable('hashPattern', table => {
      table.dropIndex('pattern')
    }))
}
