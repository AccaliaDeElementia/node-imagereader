'use sanity'

const similarPrefixes = () => {
  const patterns = Array(16).fill(0).map((_, i) => 1 << i)
  patterns.push(0)
  // I may be able to use a distance of 1 only....?
  // patterns.push(...patterns.map(r => patterns.map(q => r ^ q)).flat())
  const toKey = i => `0000${i.toString(16)}`.slice(-4).toUpperCase()
  const map = {}
  for (let i = 0; i < 1 << 16; i++) {
    let line = patterns.map(pattern => i ^ pattern)
    line = line.filter((item, index) => line.indexOf(item) === index)
    line.sort((a, b) => a - b)
    map[toKey(i)] = line.map(toKey)
  }
  return map
}

exports.up = function (knex) {
  return knex.schema
    .createTable('perceptualFingerprint', table => {
      table.bigIncrements('id').primary()
      table.bigInteger('picture').references('pictures.id').notNull().onDelete('cascade')
      table.string('filename', 8192)
      table.integer('width')
      table.integer('height')
      table.string('format', 10)
      table.string('filesize', 25)
      table.decimal('elapsedTime', 12, 3)
      table.string('hexHash', 64)
      table.string('hash', 8192)
    })
    .createTable('perceptualComparison', table => {
      table.bigIncrements('id')
      table.bigInteger('left').references('perceptualFingerprint.id').notNull().onDelete('cascade')
      table.bigInteger('right').references('perceptualFingerprint.id').notNull().onDelete('cascade')
      table.decimal('distance', 15, 8)
      table.boolean('falsePositive').default(false)
    })
    .createTable('hashPattern', table => {
      table.increments('id')
      table.string('pattern', 16)
      table.string('matches', 16)
    }).then(async () => {
      const map = similarPrefixes()
      for (const pattern in map) {
        await knex('hashPattern').insert(map[pattern].map(matches => {
          return {
            pattern,
            matches
          }
        }))
      }
    })
}

exports.down = function (knex) {
  return knex.schema
    .dropTable('perceptualComparison')
    .dropTable('perceptualFingerprint')
    .dropTable('hashPrefixes')
}
