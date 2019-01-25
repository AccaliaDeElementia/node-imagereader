'use sanity'

const logLimit = 1e3

class Synchronizer {
  constructor ({
    name,
    description,
    executor = () => Promise.reject(new Error('NO EXECUTOR SPECIFIED')),
    runImmediately = false,
    isEnabled = true,
    useJitter = false,
    jitterFactor = 0.5,
    runInterval = 24 * 60 * 60 * 1000
  }) {
    this._executor = executor
    this.data = {
      name,
      description,
      isEnabled,
      useJitter,
      jitterFactor,
      runInterval,
      runImmediately,
      lastRunEnd: 0,
      lastRunStart: 0
    }
    this.logger = require('debug')(`imagereader:synchronizer:${this.data.name}`)
    this.log = []
    this.lastRunStart = 0
    this.lastRunEnd = 0
    this.scheduledAt = 0
  }

  toWebData () {
    return Object.assign({ log: this.log }, this.data)
  }

  async initialize (db) {
    const configs = await db('synchronizers')
      .select()
      .where({ name: this.data.name })
    if (configs.length > 0) {
      this.data = configs[0]
      this.data.isEnabled = !!this.data.isEnabled
      this.data.runImmediately = !!this.data.runImmediately
      this.data.useJitter = !!this.data.useJitter
      delete this.data.id
    } else {
      await db('synchronizers').insert(this.data)
    }
    if (!this.data.runImmediately) {
      this.schedule()
    }
  }

  async save (db) {
    await db('synchronizers')
      .update(this.data)
      .where({ name: this.data.name })
  }

  schedule () {
    let start = Date.now() + this.data.runInterval
    if (this.data.useJitter) {
      start += (Math.random() - 0.5) * this.data.runInterval * this.data.jitterFactor
    }
    this.scheduledAt = start
  }

  logMessage (...lines) {
    const prefix = `[${(new Date()).toISOString().substring(11, 23)}] `
    lines = lines.map(line => `${prefix}${line}`)
    for (let line of lines) {
      this.logger(line)
    }
    this.log.push(...lines)
    if (this.log.length > logLimit) {
      this.log = this.log.slice(-logLimit)
    }
  }

  async executeSchedule (db) {
    const now = Date.now()
    if (!this.data.isEnabled || now < this.scheduledAt) {
      return
    }
    await this.execute(db)
  }

  async execute (db) {
    const now = Date.now()
    if (this.isRunning) {
      return
    }
    this.isRunning = true
    this.data.lastRunStart = now
    try {
      await this.save(db)
      await this._executor(db, this.logMessage.bind(this))
      this.data.lastRunEnd = Date.now()
      await this.save(db)
    } catch (e) {
      this.logMessage(`Error executing ${this.name}: ${e.message}`, e.stack)
    }
    this.schedule()
    this.isRunning = false
  }
}

module.exports = Synchronizer
