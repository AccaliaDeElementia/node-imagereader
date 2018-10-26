const express = require('express')

const hentaifoundry = require('./hentaifoundry')

module.exports = db => {
  const router = express.Router()
  router.use('/hentaifoundry', hentaifoundry(db))
  router.get('/', (req, res) => res.redirect('/settings/hentaifoundry'))
  return router
}
