
async function delay (milliseconds = 100) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds / 2 + Math.random() * milliseconds)
  })
}

const toSortKey = name => {
  const base = '0'.repeat(30)
  return name.toLowerCase().replace(/(\d+)/g, num => `${base}${num}`.slice(-30))
}

module.exports = {
  delay,
  toSortKey
}
