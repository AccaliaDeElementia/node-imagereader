'use sanity'

const Synchronizer = require('./synchronizer')
const { PerceptualHasher } = require('../utils/perceptualHasher')

const fetchImages = async (db, logger) => {
  const pictures = await db('pictures')
    .select(['pictures.id', 'pictures.path'])
    .leftJoin('perceptualFingerprint', 'pictures.id', 'perceptualFingerprint.picture')
    .whereNull('perceptualFingerprint.id')
    .limit(1000)
  logger(`Found ${pictures.length} images to process...`)
  return pictures
}

const computeHashes = async (pictures, db, logger) => {
  let hashes = []
  const hasher = new PerceptualHasher()
  for (let i = 0; i < pictures.length; i++) {
    logger(`Computing hash for ${i + 1} of ${pictures.length} - ${pictures[i].path}`)
    try {
      const hash = await hasher.GetHash(pictures[i].path)
      hash.picture = pictures[i].id
      hash.hash = JSON.stringify(hash.hash)
      hashes.push(hash)
    } catch (e) {
      logger(`Failed to process ${pictures[i].path}`, e.message, e.stack)
      continue
    }
    if (hashes.length >= 100) {
      await db('perceptualFingerprint').insert(hashes)
      hashes = []
    }
  }
  if (hashes.length > 0) {
    await db('perceptualFingerprint').insert(hashes)
  }
  logger('All hashes computed and stored')
}

const compareNewHashes = async (db, logger) => {
  const hasher = new PerceptualHasher()
  let page = 0
  while (true) {
    const calculations = await db({
      left: 'perceptualFingerprint',
      right: 'perceptualFingerprint'
    })
      .select([
        'left.id as leftid',
        'right.id as rightid',
        'left.hash as lefthash',
        'right.hash as righthash'
      ])
      .leftJoin('perceptualComparison', function () {
        this.on('left.id', '=', 'perceptualComparison.left')
          .andOn('right.id', '=', 'perceptualComparison.right')
      })
      .joinRaw('inner join hashPattern as hp1 on substr(??, 1, 4) = hp1.pattern and substr(??, 1, 4) = hp1.matches', ['left.hexHash', 'right.hexHash'])
      .joinRaw('inner join hashPattern as hp2 on substr(??, 5, 4) = hp2.pattern and substr(??, 5, 4) = hp2.matches', ['left.hexHash', 'right.hexHash'])
      .whereRaw('left.id < right.id and perceptualComparison.id is null')
      .limit(5000)
    if (calculations.length === 0) {
      break
    }
    logger(`Found ${calculations.length} new hash pairs to compare`)
    let comparisons = []
    for (let i = 0; i < calculations.length; i++) {
      const calc = calculations[i]
      const distance = hasher.CalculateDistance(
        JSON.parse(calc.lefthash),
        JSON.parse(calc.righthash)
      )
      comparisons.push({
        left: calc.leftid,
        right: calc.rightid,
        distance
      })
      if (i % 1000 === 0) {
        logger(`Compared ${page + i} hash pairs...`)
      }
      if (comparisons.length >= 100) {
        await db('perceptualComparison').insert(comparisons)
        page += comparisons.length
        comparisons = []
      }
    }
    if (comparisons.length > 0) {
      page += comparisons.length
      await db('perceptualComparison').insert(comparisons)
    }
    logger(`Compared ${page} total hash pairs...`)
  }
  logger('All has pairs compared and stored')
}

const runSync = async (db, logger) => {
  const start = Date.now()
  logger('Begin Search for Similar Images')
  const pictures = await fetchImages(db, logger)
  await computeHashes(pictures, db, logger)
  await compareNewHashes(db, logger)
  logger(`Process complete after ${(Date.now() - start) / 1000}s`)
}

module.exports = new Synchronizer({
  name: 'Find Similar Images',
  description: 'Locates similar images to reduce duplication in the image sets',
  executor: runSync,
  runImmediately: false,
  runInterval: 24 * 60 * 60 * 1000,
  useJitter: false
})

module.exports.compareNewHashes = compareNewHashes
