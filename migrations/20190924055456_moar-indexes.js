
const doIndexes = (knex, on, off) => knex.schema.alterTable('perceptualFingerprint', table => {
  ['hexHashA', 'hexHashB', 'hexHashC', 'hexHashD'].forEach(i => table[off](i))
  table[on]([
    'hexHashA',
    'hexHashB',
    'hexHashC',
    'hexHashD'
  ])
})
  .then(() => knex.schema.alterTable('perceptualComparison', table => {
    table[on]([
      'left',
      'right'
    ])
  }))

exports.up = function (knex) {
  return doIndexes(knex, 'index', 'dropIndex')
}

exports.down = function (knex) {
  return doIndexes(knex, 'dropIndex', 'index')
}
