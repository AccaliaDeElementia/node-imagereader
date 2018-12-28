const express = require('express')
const { api } = require('./api')
module.exports = (db) => {
  const router = express.Router()
  const rootRoute = async (req, res) => {
    const folder = '/' + (req.params[0] || '')
    const data = await api.listing(db, folder)
    const bookmarks = await api.getBookmarks(db, folder)
    res.render('index', { data, bookmarks })
  }
  router.get('/', rootRoute)
  router.get('/show', rootRoute)
  router.get('/show/*', rootRoute)
  return router
}
