
exports.up = function(knex) {
  return knex.schema.alterTable('perceptualFingerprint', table => {
    table.index('hexHashA')
    table.index('hexHashB')
    table.index('hexHashC')
    table.index('hexHashD')
  })
  .then(() => knex.schema.alterTable('hashPattern', table => {
    table.index('pattern')
  }))
};

exports.down = function(knex) {
  knex.schema.alterTable('perceptualFingerprint', table => {
    table.dropIndex('hexHashA')
    table.dropIndex('hexHashB')
    table.dropIndex('hexHashC')
    table.dropIndex('hexHashD')
  })
  .then(() => knex.schema.alterTable('hashPattern', table => {
    table.dropIndex('pattern')
  }))
};
