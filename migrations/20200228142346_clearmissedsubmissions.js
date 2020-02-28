exports.up = function (knex) {
  return knex('furaffinitysync').where('submission', '>', 35121213).delete()
}

exports.down = function (knex) {
}