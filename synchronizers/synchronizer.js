'use sanity'

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
      runInterval
    }
    this.logger = require('debug')(`imagereader:synchronizer:${this.data.name}`)
    this.log = []
    this.lastRunStart = 0
    this.lastRunEnd = 0
    this.scheduledAt = 0
    if (!runImmediately) {
      this.schedule()
    }
  }

  schedule () {
    let start = Date.now() + this.data.runInterval
    if (this.data.useJitter) {
      start += (Math.random() - 0.5) * this.data.runInterval
    }
    this.scheduledAt = start
  }

  logMessage (...lines) {
    for (let line of lines) {
      this.logger(line)
    }
    this.log.push(...lines)
    if (this.log.length > 200) {
      this.log = this.log.slice(-200)
    }
  }

  async execute (db) {
    const now = Date.now()
    if (now < this.scheduledAt || this.isRunning) {
      return
    }
    this.isRunning = true
    this.lastRunStart = now
    try {
      await this._executor(db, this.logMessage.bind(this))
    } catch (e) {
      this.logMessage(`Error executing ${this.name}: ${e.message}`, e.stack)
    }
    this.lastRunEnd = Date.now()
    this.schedule()
    this.isRunning = false
  }
}

module.exports = Synchronizer
