const express = require('express')

const hentaifoundry = require('./hentaifoundry')
const syncs = require('./synchronizers')

module.exports = db => {
  const router = express.Router()
  router.use('/hentaifoundry', hentaifoundry(db))
  router.use('/syncs', syncs(db))
  router.get('/', (req, res) => res.redirect('/settings/hentaifoundry'))
  return router
}
