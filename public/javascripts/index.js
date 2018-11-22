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
  $('#folders-tab').tab('show')
  $('#mainMenu').show()
} else {
  $('#mainImage img').show()
}

const setBookmark = () => {
  $.post('/api/bookmarks/add', { path: picturereaderdata.pictures[imageIdx].path })
  $('#mainMenu').hide()
}
$('.action-block .action-bookmark').click(setBookmark)

let imageIdx = 0
picturereaderdata.pictures.forEach((f, i) => {
  if (f.path === picturereaderdata.current) {
    imageIdx = i
  }
})

const nope = () => {
  $('.navbar').addClass('ease').removeClass('bg-light').addClass('bg-danger')
  setTimeout(() => $('.navbar').addClass('bg-light'), 500)
  setTimeout(() => $('.navbar').removeClass('ease').removeClass('bg-danger'), 1000)
}

const loadImage = () => {
  const pic = picturereaderdata.pictures[imageIdx]
  if (!pic) {
    return
  }
  pic.seen = true
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
  markRead: () => {
    $.ajax({
      method: 'POST',
      url: '/api/mark/read',
      data: { path: picturereaderdata.path },
      complete: () => window.location.reload(true)
    })
  },
  markUnRead: () => {
    $.ajax({
      method: 'POST',
      url: '/api/mark/unread',
      data: { path: picturereaderdata.path },
      complete: () => window.location.reload(true)
    })
  },
  firstImage: () => {
    imageIdx = 0
    loadImage()
  },
  nextImage: () => {
    if (imageIdx < picturereaderdata.pictures.length - 1) {
      imageIdx++
      loadImage()
    } else {
      nope()
    }
  },
  randomImage: () => {
    imageIdx = Math.floor(Math.random() * picturereaderdata.pictures.length)
    loadImage()
  },
  prevImage: () => {
    if (imageIdx > 0) {
      imageIdx--
      loadImage()
    } else {
      nope()
    }
  },
  lastImage: () => {
    imageIdx = picturereaderdata.pictures.length - 1
    loadImage()
  },
  nextFolder: () => {
    if (picturereaderdata.nextFolder) {
      window.location = picturereaderdata.nextFolder
    } else {
      nope()
    }
  },
  previousFolder: () => {
    if (picturereaderdata.previousFolder) {
      window.location = picturereaderdata.previousFolder
    } else {
      nope()
    }
  },
  previousUnseen: () => {
    let idx = imageIdx
    while (idx > 0) {
      idx--
      if (!picturereaderdata.pictures[idx].seen) {
        imageIdx = idx
        loadImage()
        return
      }
    }
    nope()
  },
  nextUnseen: () => {
    let idx = imageIdx
    while (idx < picturereaderdata.pictures.length - 1) {
      idx++
      if (!picturereaderdata.pictures[idx].seen) {
        imageIdx = idx
        loadImage()
        return
      }
    }
    nope()
  },
  fullscreen: () => {
    if (!window.document.webkitFullscreenElement) {
      window.document.body.webkitRequestFullscreen({
        navigationUI: false
      })
    } else {
      window.document.webkitExitFullscreen()
    }
  },
  parentfolder: () => {
    window.location = `/show${picturereaderdata.parent}`
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

$('.action-block .action-nextfolder').click(navigation.nextFolder)
$('.action-block .action-previousfolder').click(navigation.previousFolder)
$('.action-block .action-nextunseen').click(navigation.nextUnseen)
$('.action-block .action-previousunseen').click(navigation.previousUnseen)
$('.action-block .action-fullscreen').click(navigation.fullscreen)
$('.action-block .action-parentfolder').click(navigation.parentfolder)
$('.action-block .action-markallseen').click(navigation.markRead)
$('.action-block .action-markallunseen').click(navigation.markUnRead)

const limit = Math.tan(45 * 1.5 / 180 * Math.PI)

let pendingTouch = null
$('#mainImage').on('touchstart', event => {
  if (!pendingTouch) {
    pendingTouch = event.originalEvent.changedTouches[0]
  }
}).on('touchend', event => {
  const touch = event.originalEvent.changedTouches[0]
  if (pendingTouch && pendingTouch.identifier === touch.identifier) {
    console.log(window.visualViewport.scale, initialScale, pendingTouch, touch)
    if (!window.visualViewport || window.visualViewport.scale <= initialScale) {
      handleGesture(pendingTouch, touch)
    }
    pendingTouch = null
  }
}).on('click', evt => {
  if ($('#mainMenu').is(':visible')) {
    $('#mainMenu').hide()
    return
  }
  if (window.visualViewport && window.visualViewport.scale > initialScale) {
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

const initialScale = window.visualViewport ? window.visualViewport.scale : 1

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
