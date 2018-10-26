const express = require('express')

module.exports = db => {
  const router = express.Router()
  /* GET home page. */
  router.get('/', async function (req, res) {
    const watchedusers = (await db.select(['hentaifoundrywatched.user', 'hentaifoundrywatched.active']).count('hentaifoundrysync.id as count').from('hentaifoundrywatched')
      .leftJoin('hentaifoundrysync', 'hentaifoundrywatched.user', 'hentaifoundrysync.user')
      .groupBy('hentaifoundrywatched.user'))
      .sort((a, b) => b.count - a.count)
    res.render('options/hentaifoundry', { watchedusers })
  })

  const addUser = async (req, res) => {
    try {
      await db.insert({ user: req.params.user, active: 1 }).into('hentaifoundrywatched')
    } catch (e) { }
    try {
      const user = await db.select().from('hentaifoundrywatched').where({ user: req.params.user })
      res.status(200).json(user[0])
    } catch (err) {
      res.status(500).send(err.message)
    }
  }

  const deleteUser = async (req, res) => {
    let user
    try {
      user = await db.select().from('hentaifoundrywatched').where({ user: req.params.user })
    } catch (e) {
      console.error(e.message, e.stackTrace)
      return res.status(404).end()
    }
    try {
      await db.delete().from('hentaifoundrysync').where({ user: req.params.user })
      await db.delete().from('hentaifoundrywatched').where({ user: req.params.user })
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
      await db('hentaifoundrywatched').update({ active: status }).where({ user: req.params.user })
    } catch (e) {
      console.error(e.message, e.stackTrace)
      return res.status(404).end()
    }
    try {
      const user = await db.select().from('hentaifoundrywatched').where({ user: req.params.user })
      res.status(200).json(user[0])
    } catch (err) {
      res.status(500).send(err.message)
    }
  }

  router.patch('/:user/deactivate', chActivate(0))
  router.patch('/:user/activate', chActivate(1))

  return router
}
