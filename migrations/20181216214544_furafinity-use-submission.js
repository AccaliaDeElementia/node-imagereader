
exports.up = function (knex, Promise) {
  return knex('furaffinitysync').update({
    submission: knex.raw('id')
  })
}

exports.down = function (knex, Promise) {

}
