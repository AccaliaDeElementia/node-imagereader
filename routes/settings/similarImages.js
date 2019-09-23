'use sanity'
const { Router } = require('express')
const { basename, dirname, join, resolve } = require('path')
const { unlink } = require('fs-extra')

const config = require('../../utils/config')


const toUri = uri => uri.split('/').map(encodeURIComponent).join('/')
const getImages = async (db, width, height, page = 1, perPage = 10) => (await db('perceptualComparison')
  .select([
    'perceptualComparison.id as id',
    'perceptualComparison.distance as perceptualDistance',
    'leftFingerprint.width as leftWidth',
    'leftFingerprint.height as leftHeight',
    'leftFingerprint.format as leftFormat',
    'leftFingerprint.filesize as leftFilesize',
    'rightFingerprint.width as rightWidth',
    'rightFingerprint.height as rightHeight',
    'rightFingerprint.format as rightFormat',
    'rightFingerprint.filesize as rightFilesize',
    'leftImage.path as leftImagePath',
    'leftImage.seen as leftImageSeen',
    'leftImage.id as leftId',
    'rightImage.path as rightImagePath',
    'rightImage.seen as rightImageSeen',
    'rightImage.id as rightId'
  ])
  .join('perceptualFingerprint as leftFingerprint', function() {
    this.on('leftFingerprint.id', '=', 'perceptualComparison.left')
  })
  .join('perceptualFingerprint as rightFingerprint', function() {
    this.on('rightFingerprint.id', '=', 'perceptualComparison.right')
  })
  .join('pictures as leftImage', function() {
    this.on('leftImage.id', '=', 'leftFingerprint.picture')
  })
  .join('pictures as rightImage', function() {
    this.on('rightImage.id', '=', 'rightFingerprint.picture')
  })
  .where('perceptualComparison.falsePositive', '=', false)
  .orderBy('perceptualComparison.distance')
  .offset((page - 1) * perPage)
  .limit(perPage))
  .map(entry => {
    return {
      id: entry.id,
      distance: entry.perceptualDistance,
      left: {
        id: entry.leftId,
        preview: join(`/images/${width}-${height}`, toUri(entry.leftImagePath)),
        fullsize: join('/images/fullsize', toUri(entry.leftImagePath)),
        name: basename(entry.leftImagePath),
        folder: dirname(entry.leftImagePath),
        width: entry.leftWidth,
        height: entry.leftHeight,
        filesize: entry.leftFilesize,
        format: entry.leftFormat
      },
      right: {
        id: entry.rightId,
        preview: join(`/images/${width}-${height}`, toUri(entry.rightImagePath)),
        fullsize: join('/images/fullsize', toUri(entry.rightImagePath)),
        name: basename(entry.rightImagePath),
        folder: dirname(entry.rightImagePath),
        width: entry.rightWidth,
        height: entry.rightHeight,
        filesize: entry.rightFilesize,
        format: entry.rightFormat
      }
    }
  })

const title = 'Similar Images'

module.exports = db => {
  const router = Router()
  router.get('/', (req, res) => {
    res.redirect(req.baseUrl+'/page/1')
  })
  router.get('/page/:page', async (req, res) => {
    const width = 500
    const height = 400
    const pages = Math.ceil((await db('perceptualComparison').where('distance', '<', 5).count('* as total'))[0].total / 10)
    const page = Math.min(Math.max(1, +req.params.page), pages)
    if (`${page}` != req.params.page){
      return res.redirect(`${req.baseUrl}/page/${page}`)
    }
    const images = await getImages(db, width, height, page)
    res.render('options/similarImages', { images, title, page, pages, preview: {width, height} })
  })
  router.delete('/delete/:id', async (req, res) => {
    try{
      const image = (await db('pictures').select('id', 'path').where('id', '=', req.params.id))[0]
      if (!image){
        return res.status(404).end()
      }
      await unlink(resolve(join(config.imageRoot, image.path)))
      await db('pictures').where('id', '=', req.params.id).delete()
      res.status(200).end()
    } catch (e) {
      res.status(500).send(e.message).end()
    }
  })
  router.post('/falsePositive/:id', async (req, res) => {
    try{
      const comparison = (await db('perceptualComparison').select('id').where('id', '=', req.params.id))[0]
      if (!comparison){
        return res.status(404).end()
      }
      await db('perceptualComparison').update({
        'falsePositive': true
      }).where('id', '=', req.params.id)
      res.status(200).end()
    } catch (e) {
      res.status(500).send(e.message).end()
    }
  })
  return router
}
