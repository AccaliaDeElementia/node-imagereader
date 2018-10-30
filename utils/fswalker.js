'use sanity'

const fse = require('fs-extra')
const join = require('path').join

async function fsWalker (root, eachItem) {
  const queue = ['/']
  if (!eachItem) {
    eachItem = () => Promise.resolve()
  }
  while (queue.length > 0) {
    const current = queue.shift()
    const items = await fse.readdir(join(root, current), {
      encoding: 'utf8',
      withFileTypes: true
    })
    for (let item of items) {
      if (item.name[0] === '.') {
        // skip hidden files
        continue
      }
      const path = join(current, item.name)
      if (item.isDirectory()) {
        queue.push(path)
        await eachItem({ path, isFile: false })
      } else {
        await eachItem({ path, isFile: true })
      }
    }
  }
}

module.exports = fsWalker
