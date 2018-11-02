'use sanity'

const { Router } = require('express')

const syncfolders = require('../../synchronizers/syncfolders')
const synchentaifoundry = require('../../synchronizers/hentaifoundry')

module.exports = db => {
  const syncs = [
    syncfolders,
    synchentaifoundry
  ]

  setInterval(() => syncs.forEach(sync => sync.execute(db)), 1000)

  const router = Router()
  return router
}
