'use sanity'
/* global $, picturereaderdata */

const encode = path => {
  const mapper = str => encodeURIComponent(str).replace(/#/g, '%35')
  return path.split('/').map(mapper).join('/')
}

$('#mainMenuItem').click(() => {
  $('#mainMenu').toggle()
})

$('#bookmarks button.remove').on('click', function () {
  const self = $(this).closest('.card')
  $.ajax({
    method: 'DELETE',
    url: self.data('link'),
    complete: () => self.remove()
  })
})

if (!picturereaderdata.pictures.length) {
  $('#mainMenu').show()
} else {
  const setBookmark = () => {
    $.post('/api/bookmarks/add', { path: picturereaderdata.pictures[imageIdx].path })
    $('#mainMenu').hide()
  }
  $('.action-block .action-bookmark').click(setBookmark)

  $('#mainImage img').show()
  let imageIdx = 0
  picturereaderdata.pictures.forEach((f, i) => {
    if (f.path === picturereaderdata.current) {
      imageIdx = i
    }
  })

  const loadImage = () => {
    const pic = picturereaderdata.pictures[imageIdx]
    $('title').text(picturereaderdata.name)
    $('nav .title').text(picturereaderdata.name)
    $('.status-bar .center').text(pic.name)
    $('.status-bar .left').text(`(${imageIdx + 1}/${picturereaderdata.pictures.length})`)
    $.post('/api/navigate/latest', { path: pic.path })
    $('#mainImage img').attr('src', encode(pic.path))
    $('#mainMenu').hide()
  }
  loadImage()

  $('#pictures .card').click(function () {
    imageIdx = +$(this).data('index')
    loadImage()
  })

  const navigation = {
    firstImage: () => {
      imageIdx = 0
      loadImage()
    },
    nextImage: () => {
      if (imageIdx < picturereaderdata.pictures.length - 1) {
        imageIdx++
      }
      loadImage()
    },
    randomImage: () => {
      imageIdx = Math.floor(Math.random() * picturereaderdata.pictures.length)
      loadImage()
    },
    prevImage: () => {
      if (imageIdx > 0) {
        imageIdx--
      }
      loadImage()
    },
    lastImage: () => {
      imageIdx = picturereaderdata.pictures.length - 1
      loadImage()
    }
  }
  document.onkeyup = (evt) => {
    if ($('#mainMenu').is(':visible')) {
      return
    }
    var key = (evt.ctrlKey ? '<CTRL>' : '') +
        (evt.altKey ? '<ALT>' : '') +
        (evt.shiftKey ? '<SHIFT>' : '') +
        evt.key.toUpperCase()
    var action = ''
    switch (key) {
      case 'ARROWRIGHT':
        action = 'nextImage'
        break
      case 'ARROWLEFT':
        action = 'prevImage'
        break
    }
    (navigation[action] || function () {})()
  }
  $('.action-block .action-first').click(navigation.firstImage)
  $('.action-block .action-previous').click(navigation.prevImage)
  $('.action-block .action-random').click(navigation.randomImage)
  $('.action-block .action-next').click(navigation.nextImage)
  $('.action-block .action-last').click(navigation.lastImage)

  const limit = Math.tan(45 * 1.5 / 180 * Math.PI)

  let pendingTouch = null
  $('#mainImage').on('touchstart', event => {
    if (!pendingTouch) {
      pendingTouch = event.originalEvent.changedTouches[0]
    }
  }).on('touchend', event => {
    const touch = event.originalEvent.changedTouches[0]
    if (pendingTouch && pendingTouch.identifier === touch.identifier) {
      handleGesture(pendingTouch, touch)
      pendingTouch = null
    }
  }).on('click', evt => {
    if ($('#mainMenu').is(':visible')) {
      $('#mainMenu').hide()
      return
    }
    const pageWidth = window.innerWidth || document.body.clientWidth
    const x = evt.pageX
    if (x < pageWidth / 3) {
      navigation.prevImage()
    } else if (x < pageWidth * 2 / 3) {
      $('#mainMenu').show()
    } else {
      navigation.nextImage()
    }
  })

  const handleGesture = (startTouch, endTouch) => {
    const pageWidth = window.innerWidth || document.body.clientWidth
    const treshold = Math.max(25, Math.floor(0.02 * (pageWidth)))
    const swipeX = endTouch.screenX - startTouch.screenX
    const swipeY = endTouch.screenY - startTouch.screenY
    const swipeVertical = Math.abs(swipeX / swipeY) <= limit
    const swipeHorizontal = Math.abs(swipeY / swipeX) <= limit
    if (Math.abs(swipeX) > treshold || Math.abs(swipeY) > treshold) {
      if (swipeHorizontal) {
        if (swipeX > 0) {
          navigation.prevImage()
        } else {
          navigation.nextImage()
        }
      }
      if (swipeVertical) {
        if (swipeY > 0) {
          $('#mainMenu').show()
        }
      }
    } else {
      if (endTouch.screenX < pageWidth / 3) {
        // navigation.prevImage()
      } else if (endTouch.screenX < pageWidth * 2 / 3) {
        $('#mainMenu').show()
      } else {
        // navigation.nextImage()
      }
    }
  }
}
