
exports.up = function (knex) {
  return knex('furaffinitysync').update({
    submission: knex.raw('id')
  })
}

exports.down = function (knex) {

}
