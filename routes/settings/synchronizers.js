'use sanity'

const { Router } = require('express')

const syncfolders = require('../../synchronizers/syncfolders')
const synchentaifoundry = require('../../synchronizers/hentaifoundry')
const syncfuraffinity = require('../../synchronizers/furaffinity')
const findSimilarImages = require('../../synchronizers/similarImages')

module.exports = db => {
  const syncs = [
    syncfolders,
    synchentaifoundry,
    syncfuraffinity,
    findSimilarImages
  ]

  syncs.forEach(sync => sync.initialize(db))

  setInterval(() => syncs.forEach(sync => sync.executeSchedule(db)), 1000)

  const router = Router()

  router.get('/', async (req, res) => {
    const webSyncs = syncs.map(sync => sync.toWebData())
    res.render('options/synchronizers', { title: 'Synchronizers', syncs: webSyncs })
  })

  router.get('/:index(\\d+)', async (req, res) => {
    const sync = syncs[+req.params.index]
    if (!sync) {
      return res.redirect('/settings/syncs')
    }
    const websync = sync.toWebData()
    res.render('options/synchronizer', { title: `Synchronizer: ${websync.name}`, index: +req.params.index, sync: websync })
  })

  router.get('/:index(\\d+)/log', async (req, res) => {
    const sync = syncs[+req.params.index]
    if (!sync) {
      return res.redirect('/settings/syncs')
    }
    res.send(sync.log.join('\n')).end()
  })

  router.get('/:index(\\d+)/run', async (req, res) => {
    const sync = syncs[+req.params.index]
    if (!sync) {
      return res.redirect('/settings/syncs')
    }
    sync.execute(db)
    res.redirect(`/settings/syncs/${req.params.index}`)
  })

  router.post('/save', async (req, res) => {
    const sync = syncs[+req.body.id]
    if (!sync) {
      return res.redirect('.')
    }
    sync.data.description = req.body.syncDescription
    sync.data.isEnabled = req.body.syncEnabled === 'on'
    sync.data.runImmediately = req.body.syncRunImmediately === 'on'
    sync.data.useJitter = req.body.syncJitter === 'on'
    sync.data.jitterFactor = +req.body.syncJitterFactor / 100
    sync.data.runInterval = req.body.runInterval
    await sync.save(db)
    res.redirect(`./${req.body.id}`)
  })
  return router
}
