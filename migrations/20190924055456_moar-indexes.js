
exports.up = function (knex) {
  return knex.schema.alterTable('perceptualFingerprint', table => {
    table.dropIndex('hexHashA')
    table.dropIndex('hexHashB')
    table.dropIndex('hexHashC')
    table.dropIndex('hexHashD')
    table.index([
      'hexHashA',
      'hexHashB',
      'hexHashC',
      'hexHashD'
    ])
  })
    .then(() => knex.schema.alterTable('perceptualComparison', table => {
      table.index([
        'left',
        'right'
      ])
    }))
}

exports.down = function (knex) {
  return knex.schema.alterTable('perceptualFingerprint', table => {
    table.index('hexHashA')
    table.index('hexHashB')
    table.index('hexHashC')
    table.index('hexHashD')
    table.dropIndex([
      'hexHashA',
      'hexHashB',
      'hexHashC',
      'hexHashD'
    ])
  })
    .then(() => knex.schema.alterTable('perceptualComparison', table => {
      table.dropIndex([
        'left',
        'right'
      ])
    }))
}
