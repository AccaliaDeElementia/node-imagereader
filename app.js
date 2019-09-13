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

  app.get('/*', (_, res, next) => {
    res.set('X-Clacks-Overhead', 'GNU Terry Pratchett')
    next()
  })

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
  const imagesRouter = require('./routes/images')(db)
  app.use('/', indexRouter)
  app.use('/api', apiRouter)
  app.use('/settings', settingsRouter)
  app.use('/images', imagesRouter)
  return app
}

// App startup boilerplate
async function startServer (app) {
  const server = require('http').createServer(app)
  // error handler
  // catch 404 and forward to error handler
  const createError = require('http-errors')
  app.use(function (_, __, next) {
    next(createError(404))
  })

  app.use(function (err, req, res, _) {
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

setupMiddleware()
  .then(createRouters)
  .then(startServer)
  .then(() => console.log('Startup complete'))
