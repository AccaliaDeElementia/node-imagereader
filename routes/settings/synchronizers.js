'use sanity'

const { Router } = require('express')

const syncfolders = require('../../synchronizers/syncfolders')
const synchentaifoundry = require('../../synchronizers/hentaifoundry')
const syncfuraffinity = require('../../synchronizers/furaffinity')

module.exports = db => {
  const syncs = [
    syncfolders,
    synchentaifoundry,
    syncfuraffinity
  ]

  setInterval(() => syncs.forEach(sync => sync.execute(db)), 1000)

  const router = Router()
  return router
}
