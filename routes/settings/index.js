const express = require('express')

const watchedusers = require('./watchedusers')
const syncs = require('./synchronizers')

module.exports = db => {
  const router = express.Router()
  router.use('/hentaifoundry', watchedusers(db, 'hentaifoundry', 'Hentai Foundry - Watched Users'))
  router.use('/furaffinity', watchedusers(db, 'furaffinity', 'Fur Affinity [dot] net - Watched Users'))
  router.use('/syncs', syncs(db))
  router.get('/', (req, res) => res.redirect('/settings/hentaifoundry'))
  return router
}
