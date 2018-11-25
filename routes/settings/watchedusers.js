'use sanity'

const express = require('express')

module.exports = (db, prefix, title) => {
  const router = express.Router()
  /* GET home page. */
  router.get('/', async function (req, res) {
    const watchedusers = (await db.select([`${prefix}watched.user`, `${prefix}watched.active`]).count(`${prefix}sync.id as count`).from(`${prefix}watched`)
      .leftJoin(`${prefix}sync`, `${prefix}watched.user`, `${prefix}sync.user`)
      .groupBy(`${prefix}watched.user`, `${prefix}watched.active`))
      .sort((a, b) => b.count - a.count)
    res.render('options/watchedusers', { watchedusers, title })
  })

  const addUser = async (req, res) => {
    try {
      await db.insert({ user: req.params.user, active: 1 }).into(`${prefix}watched`)
    } catch (e) { }
    try {
      const user = await db.select().from(`${prefix}watched`).where({ user: req.params.user })
      res.status(200).json(user[0])
    } catch (err) {
      res.status(500).send(err.message)
    }
  }

  const deleteUser = async (req, res) => {
    let user
    try {
      user = await db.select().from(`${prefix}watched`).where({ user: req.params.user })
    } catch (e) {
      console.error(e.message, e.stackTrace)
      return res.status(404).end()
    }
    try {
      await db.delete().from(`${prefix}sync`).where({ user: req.params.user })
      await db.delete().from(`${prefix}watched`).where({ user: req.params.user })
      res.status(200).json(user[0])
    } catch (err) {
      console.error(err.message, err.stackTrace)
      res.status(500).send(err.message)
    }
  }

  router.post('/:user', addUser)
  router.put('/:user', addUser)
  router.delete('/:user', deleteUser)

  const chActivate = (status) => async (req, res) => {
    try {
      await db(`${prefix}watched`).update({ active: status }).where({ user: req.params.user })
    } catch (e) {
      console.error(e.message, e.stackTrace)
      return res.status(404).end()
    }
    try {
      const user = await db.select().from(`${prefix}watched`).where({ user: req.params.user })
      res.status(200).json(user[0])
    } catch (err) {
      res.status(500).send(err.message)
    }
  }

  router.patch('/:user/deactivate', chActivate(0))
  router.patch('/:user/activate', chActivate(1))

  return router
}
