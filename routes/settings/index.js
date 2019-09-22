const express = require('express')

const watchedusers = require('./watchedusers')
const syncs = require('./synchronizers')
const similarImages = require('./similarImages')

module.exports = db => {
  const router = express.Router()
  router.use('/hentaifoundry', watchedusers(db, 'hentaifoundry', 'Hentai Foundry - Watched Users'))
  router.use('/furaffinity', watchedusers(db, 'furaffinity', 'Fur Affinity [dot] net - Watched Users'))
  router.use('/syncs', syncs(db))
  router.use('/similarImages', similarImages(db))
  router.get('/', (req, res) => res.redirect('/settings/syncs'))
  return router
}
