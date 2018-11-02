'use sanity'

const fse = require('fs-extra')
const { posix: { join, extname } } = require('path')

const defaultExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.tif', '.tiff', '.bmp', '.jpe']

async function fsWalker (root, eachItem, extensions = defaultExtensions) {
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
    await eachItem(items
      .filter(item => item.isDirectory()
        ? item.name[0] !== '.'
        : extensions.length === 0 || extensions.indexOf(extname(item.name).toLowerCase()) >= 0)
      .map(item => {
        const path = join(current, item.name)
        if (item.isDirectory()) {
          queue.push(path)
        }
        return { path, isFile: !item.isDirectory() }
      }), queue.length)
  }
}

module.exports = fsWalker
