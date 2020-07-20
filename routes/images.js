'use sanity'

const config = require('../utils/config')
const { normalize, join } = require('path')

const sharp = require('sharp')
const { readFile } = require('fs-extra')
const express = require('express')

module.exports = (db) => {
  class ExpressError extends Error {
    constructor (message, status = 302) {
      super(message || 'Internal Server Error')
      this.name = this.constructor.name
      Error.captureStackTrace(this, this.constructor)
      this.statusCode = status || 500
    }
  }
  const sendFile = (context) => {
    const aMonth = 1000 * 60 * 60 * 24 * 30
    context.res
      .set('Content-Type', `image/${context.ext}`)
      .set('Cache-Control', `public, max-age=${aMonth}`)
      .set('Expires', new Date(Date.now() + aMonth).toUTCString())
      .send(context.buffer)
    return context
  }
  const resizeFile = async (context) => {
    if (context.filename !== normalize(context.filename)) {
      throw new ExpressError('Directory traversal iis not allowed', 403)
    }
    context.ext = context.filename.split('.').pop().toLowerCase()

    const data = await readFile(join(config.imageRoot, context.filename))
    if (context.preview) {
      let image = sharp(data)
      if (+context.width || +context.height) {
        image = image.rotate().resize({
          width: context.width,
          height: context.height,
          fit: sharp.fit.inside,
          withoutEnlargement: true
        })
        context.ext = 'png'
      }
      context.buffer = await image.png().toBuffer()
    } else {
      context.buffer = data
    }
    return context
  }

  const router = express.Router()
  router.get('/:width-:height/*', (req, res) => Promise.resolve({
    width: req.params.width,
    height: req.params.height,
    filename: req.params[0] || '',
    req,
    res
  })
    .then(resizeFile)
    .then(sendFile))
  router.get('/fullsize/*', (req, res) => Promise.resolve({
    width: undefined,
    height: undefined,
    filename: req.params[0] || '',
    req,
    res
  })
    .then(resizeFile)
    .then(sendFile))
  router.get('/preview/*', (req, res) => Promise.resolve({
    width: 240,
    height: 320,
    filename: req.params[0] || '',
    req,
    res,
    preview: true
  })
    .then(resizeFile)
    .then(sendFile))
  return router
}
