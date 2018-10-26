
async function delay (milliseconds = 100) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds / 2 + Math.random() * milliseconds)
  })
}

module.exports = {
  delay
}
