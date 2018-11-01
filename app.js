const config = require('./utils/config')

const debug = require('debug')('imagereader:server')
const express = require('express')

const persistance = require('./utils/persistance')

const api = require('./routes/api')

// Express boilerplate
async function setupMiddleware () {
  // view engine setup
  const app = express()
  app.set('port', config.port)

  const path = require('path')
  const cookieParser = require('cookie-parser')
  const logger = require('morgan')
  const sassMiddleware = require('node-sass-middleware')

  app.set('views', path.join(__dirname, 'views'))
  app.set('view engine', 'pug')

  app.use(logger('dev'))
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))
  app.use(cookieParser())
  app.use(sassMiddleware({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public'),
    indentedSyntax: true, // true = .sass and false = .scss
    sourceMap: true
  }))
  app.use(express.static(path.join(__dirname, 'public')))
  return app
}

async function createRouters (app) {
  const db = await persistance.initialize
  const indexRouter = require('./routes/index')(db)
  const apiRouter = api(db)
  const settingsRouter = require('./routes/settings')(db)
  app.use('/', indexRouter)
  app.use('/api', apiRouter)
  app.use('/settings', settingsRouter)

  return app
}

// App startup boilerplate
async function startServer (app) {
  const server = require('http').createServer(app)
  // error handler
  // catch 404 and forward to error handler
  const createError = require('http-errors')
  app.use(function (req, res, next) {
    next(createError(404))
  })

  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message
    res.locals.error = req.app.get('env') === 'development' ? err : {}

    // render the error page
    res.status(err.status || 500)
    res.render('error')
  })
  app.on('error', error => {
    if (error.syscall !== 'listen') {
      throw error
    }

    switch (error.code) {
      case 'EACCES':
        console.error(`Port ${config.port} requires elevated privileges`)
        process.exit(1)
      case 'EADDRINUSE':
        console.error(`Port ${config.port} is already in use`)
        process.exit(1)
      default:
        throw error
    }
  })

  app.on('listening', () => {
    debug(`listening on ${config.port}`)
  })
  server.listen(config.port)
}

const oneHour = 60 * 60 * 1000
const oneDay = 24 * oneHour

const synchronizers = [{
  runner: (db) => hentaifoundry.sync(),
  baseTime: oneDay,
  scheduled: Date.now() + (Math.random() - 0.5) * oneDay,
  running: false
}, {
  runner: (db) => api.api.synchronizeDb(db),
  baseTime: oneHour,
  scheduled: 0,
  running: false
}]

function runTick (db) {
  const now = Date.now()
  synchronizers
    .filter(sync => !sync.running && sync.scheduled < now)
    .forEach(async sync => {
      sync.running = true
      await sync.runner(db)
      sync.running = false
      sync.scheduled = Date.now() + sync.baseTime + (Math.random() - 0.5) * sync.baseTime
    })
}

const hentaifoundry = require('./utils/hentaifoundry')
async function runSynchronizers () {
  const db = await persistance.initialize
  setInterval(() => runTick(db), 60 * 1000)
  runTick(db)
}

setupMiddleware()
  .then(createRouters)
  .then(startServer)
  .then(runSynchronizers())
