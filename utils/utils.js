
const delay = async (milliseconds = 100) => {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds / 2 + Math.random() * milliseconds)
  })
}

const toFolderName = (title) => title.trim().replace(/[/?<>\\:*|"^]/g, '-').replace(/[.]$/, '').replace(/^[.]+/, '')

const { wordsToNumbers } = require('words-to-numbers')

const toSortKey = (name, format = 2, padLength = 20) => {
  switch (format) {
    case 1:
      return name.toLowerCase().replace(/(\d+)/g, num => `${'0'.repeat(30)}${num}`.slice(-30))
    default:
      return `${wordsToNumbers(name.toLowerCase(), { impliedHundreds: true })}`.replace(/(\d+)/g, num => `${'0'.repeat(padLength)}${num}`.slice(-padLength))
  }
}

module.exports = {
  delay,
  toSortKey,
  toFolderName
}
