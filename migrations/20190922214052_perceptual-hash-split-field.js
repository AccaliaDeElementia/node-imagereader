
exports.up = function (knex) {
  return knex('perceptualFingerprint').delete()
    .then(() => knex('perceptualComparison').delete())
    .then(() => knex.schema.alterTable('perceptualFingerprint', table => {
      table.dropColumn('hexHash')
      table.string('hexHashA', 4)
      table.string('hexHashB', 4)
      table.string('hexHashC', 4)
      table.string('hexHashD', 4)
    }))
}

exports.down = function (knex) {
  return knex('perceptualFingerprint').delete()
    .then(() => knex('perceptualComparison').delete())
    .then(() => knex.schema.alterTable('perceptualFingerprint', table => {
      table.string('hexHash', 64)
      table.dropColumn('hexHashA')
      table.dropColumn('hexHashB')
      table.dropColumn('hexHashC')
      table.dropColumn('hexHashD')
    }))
}
