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
  .join('perceptualFingerprint as leftFingerprint', 'leftFingerprint.id', 'perceptualComparison.left')
  .join('perceptualFingerprint as rightFingerprint', 'rightFingerprint.id', 'perceptualComparison.right')
  .join('pictures as leftImage', 'leftImage.id', 'leftFingerprint.picture')
  .join('pictures as rightImage', 'rightImage.id', 'rightFingerprint.picture')
  .where('perceptualComparison.falsePositive', '=', false)
  .orderBy('perceptualComparison.distance', 'perceptualComparison.id')
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
    res.redirect(req.baseUrl + '/page/1')
  })
  router.get('/page/:page', async (req, res) => {
    const width = 500
    const height = 400
    const pages = Math.ceil((await db('perceptualComparison')
      .where('distance', '<', 5.0)
      .andWhere('falsePositive', '=', false)
      .count('* as total'))[0].total / 10)
    const page = Math.min(Math.max(1, +req.params.page), pages)
    if (`${page}` !== req.params.page) {
      return res.redirect(`${req.baseUrl}/page/${page}`)
    }
    const images = await getImages(db, width, height, page)
    res.render('options/similarImagesList', {
      images,
      title,
      page,
      pages,
      preview: {
        width,
        height
      }
    })
  })
  router.get('/id/:id', async (req, res) => {
    const data = (await db('perceptualFingerprint')
      .select([
        'perceptualFingerprint.id',
        'perceptualFingerprint.width',
        'perceptualFingerprint.height',
        'perceptualFingerprint.format',
        'perceptualFingerprint.filesize',
        'pictures.path',
        'pictures.seen'
      ])
      .join('pictures', function () {
        this.on('pictures.id', '=', 'perceptualFingerprint.picture')
      })
      .where('pictures.id', '=', req.params.id))[0]
    data.name = basename(data.path)
    data.folder = dirname(data.path)
    data.path = join('/images/640-480', toUri(data.path))
    data.siblings = (await db('perceptualComparison')
      .select([
        'perceptualComparison.id as comparisonId',
        'perceptualComparison.distance',
        'perceptualFingerprint.width',
        'perceptualFingerprint.height',
        'perceptualFingerprint.format',
        'perceptualFingerprint.filesize',
        'pictures.id as pictureId',
        'pictures.path',
        'pictures.seen'
      ])
      .join('perceptualFingerprint', 'perceptualFingerprint.id', 'perceptualComparison.right')
      .join('pictures', 'pictures.id', 'perceptualFingerprint.picture')
      .where('perceptualComparison.left', '=', data.id)
      .andWhere('perceptualComparison.falsePositive', '=', false))
      .concat(await db('perceptualComparison')
        .select([
          'perceptualComparison.id as comparisonId',
          'perceptualFingerprint.width',
          'perceptualFingerprint.height',
          'perceptualFingerprint.format',
          'perceptualFingerprint.filesize',
          'pictures.id as pictureId',
          'pictures.path',
          'pictures.seen'
        ])
        .join('perceptualFingerprint', 'perceptualFingerprint.id', 'perceptualComparison.left')
        .join('pictures', 'pictures.id', 'perceptualFingerprint.picture')
        .where('perceptualComparison.right', '=', data.id)
        .andWhere('perceptualComparison.falsePositive', '=', false))
      .map(entry => {
        return {
          id: entry.comparisonId,
          picture: entry.pictureId,
          distance: entry.distance,
          preview: join('/images/preview', toUri(entry.path)),
          fullsize: join('/images/fullsize', toUri(entry.path)),
          name: basename(entry.path),
          folder: dirname(entry.path),
          width: entry.width,
          height: entry.height,
          filesize: entry.filesize,
          format: entry.format
        }
      })
    const width = 500
    const height = 400

    res.render('options/similarImagesDetails', {
      data,
      title,
      preview: {
        width,
        height
      }
    })
  })
  router.post('/deleteImages', async (req, res) => {
    const data = req.body
    var comps = (await db('perceptualComparison')
      .select([
        'left',
        'right'
      ])
      .whereIn('id', data.selected))
      .map(row => row.right === data.fingerprint ? row.left : row.right)
    var images = await db('perceptualFingerprint')
      .select([
        'pictures.path',
        'pictures.id'
      ])
      .join('pictures', 'pictures.id', 'perceptualFingerprint.picture')
      .whereIn('perceptualFingerprint.id', comps)
    for (const image of images) {
      await unlink(resolve(join(config.imageRoot, image.path)))
    }
    await db('pictures')
      .whereIn('id', images.map(i => i.id))
      .delete()
    res.status(200).end()
  })
  router.delete('/delete/:id', async (req, res) => {
    try {
      const image = (await db('pictures')
        .select([
          'id',
          'path'
        ])
        .where('id', '=', req.params.id))[0]
      if (!image) {
        return res.status(404).end()
      }
      await unlink(resolve(join(config.imageRoot, image.path)))
      await db('pictures')
        .where('id', '=', req.params.id)
        .delete()
      res.status(200).end()
    } catch (e) {
      res.status(500).send(e.message).end()
    }
  })
  router.post('/falsePositives', async (req, res) => {
    const data = req.body
    await db('perceptualComparison')
      .update({
        falsePositive: true
      })
      .whereIn('id', data.selected)
    res.status(200).end()
  })
  router.post('/falsePositive/:id', async (req, res) => {
    try {
      const comparison = (await db('perceptualComparison')
        .select('id')
        .where('id', '=', req.params.id))[0]
      if (!comparison) {
        return res.status(404).end()
      }
      await db('perceptualComparison')
        .update({
          falsePositive: true
        }).where('id', '=', req.params.id)
      res.status(200).end()
    } catch (e) {
      res.status(500).send(e.message).end()
    }
  })
  return router
}
