
exports.up = function (knex) {
  return knex.schema.alterTable('perceptualFingerprint', table => {
    ['hexHashA', 'hexHashB', 'hexHashC', 'hexHashD'].forEach(i => table.dropIndex(i))
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
    ['hexHashA', 'hexHashB', 'hexHashC', 'hexHashD'].forEach(i => table.index(i))
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
