'use sanity'
/* global $, picturereaderdata */

$('#mainImage').on('error', () => {
  $('.navbar').addClass('ease').removeClass('bg-light').addClass('bg-danger')
  setTimeout(() => $('.navbar').addClass('bg-light'), 500)
  setTimeout(() => $('.navbar').removeClass('ease').removeClass('bg-danger'), 1000)
})

function MainMenu () {
  $('#mainMenu').on('showMenu', () => {
    setTimeout(() => $('#mainMenu').show(), 100)
  })
  $('#mainMenu').on('hideMenu', () => {
    if (!picturereaderdata.pictures.length) {
      return
    }
    $('#mainMenu').hide()
  })
  $('#mainMenu').on('toggleMenu', () => {
    if ($('#mainMenu').is(':visible')) {
      $('#mainMenu').trigger('hideMenu')
    } else {
      $('#mainMenu').trigger('showMenu')
    }
  })
  if (picturereaderdata.pictures.length && picturereaderdata.pictures.every(pic => pic.seen)) {
    $('#mainMenu').show()
  }
  if (!picturereaderdata.pictures.length) {
    $('#mainMenu').show()
  } else {
    $('#mainImage img').show()
  }
  $('#mainMenuItem').click(() => $('#mainMenu').trigger('toggleMenu'))
  $('input[name=ShowUnseenOnly]').change(() => {
    window.localStorage['ComicReader-ShowUnseenOnly'] = $('input[name=ShowUnseenOnly]').prop('checked')
  })
  $('input[name=ShowUnseenOnly]').prop('checked', window.localStorage['ComicReader-ShowUnseenOnly'] === 'true')
}
MainMenu()

function MainImage () {
  const isUnseenOnly = () => window.localStorage['ComicReader-ShowUnseenOnly'] === 'true'
  let after = () => {
    after = () => $('#mainMenu').trigger('hideMenu')
  }
  const pics = picturereaderdata.pictures
  let index = 0
  pics.forEach((f, i) => {
    if (f.path === picturereaderdata.current) {
      index = i
    }
  })
  $('#mainImage img').on('load', () => $('#loadingScreen').hide())
  const loadImage = pic => {
    if (!pic) {
      return
    }
    $('#loadingScreen').show()
    pic.seen = true
    $('title, nav .title').text(picturereaderdata.name)
    $('.status-bar .center, .description-title .title').text(pic.name)
    $('.status-bar .left').text(`(${index + 1}/${picturereaderdata.pictures.length})`)
    $.post('/api/navigate/latest', { path: pic.path })
    $('#mainImage img').attr('src', `/images/${pic.path}`).data('path', pic.path).data('index', index)
    after()
  }
  const loadDescription = pic => {
    if (!pic || !pic.path) {
      $('.menu-block .description').empty()
      $('#navigation-tab').tab('show')
      $('.has_description').hide()
      return
    }
    $.get(`/api/description${pic.path}`, (description) => {
      const node = $.parseHTML(description)
      $('.menu-block .description').empty().append(node)
      if (description && description.length > 0) {
        $('#actions-tab').tab('show')
        $('.has_description').show()
      } else {
        $('#navigation-tab').tab('show')
        $('.has_description').hide()
      }
    })
  }
  const changeImage = (isValid, action) => {
    if ($('#loadingScreen:visible').length) {
      return
    }
    if (isValid) {
      action()
      loadImage(pics[index])
      loadDescription(pics[index])
    } else {
      $('#mainImage').trigger('error')
    }
  }
  loadImage(pics[index])
  loadDescription(pics[index])
  $('body').on('random', () => changeImage(true, () => {
    index = Math.floor(Math.random() * pics.length)
  })).on('first', () => changeImage(index > 0, () => {
    index = 0
  })).on('last', () => changeImage(index < pics.length - 1, () => {
    index = pics.length - 1
  })).on('previousImage', () => changeImage(index > 0, () => {
    index--
  })).on('nextImage', () => changeImage(index < pics.length - 1, () => {
    index++
  })).on('previousUnseen', () => changeImage(pics.some(e => !e.seen), () => {
    index = pics.reduce((acc, pic, i) => !pic.seen && i < index ? Math.max(acc, i) : acc, -1)
    if (index < 0) {
      index = pics.reduce((acc, pic, i) => !pic.seen ? Math.max(acc, i) : acc, -1)
    }
  })).on('nextUnseen', () => changeImage(pics.some((e) => !e.seen), () => {
    index = pics.reduce((acc, pic, i) => !pic.seen && i > index ? Math.min(acc, i) : acc, Infinity)
    if (!isFinite(index)) {
      index = pics.reduce((acc, pic, i) => !pic.seen ? Math.min(acc, i) : acc, Infinity)
    }
  })).on('next', () => {
    if (isUnseenOnly()) {
      $('#mainImage').trigger('nextUnseen')
    } else {
      $('#mainImage').trigger('nextImage')
    }
  }).on('previous', () => {
    if (isUnseenOnly()) {
      $('#mainImage').trigger('previousUnseen')
    } else {
      $('#mainImage').trigger('previousImage')
    }
  }).on('loadIndex', (_, i) => changeImage(true, () => {
    index = +i
  })).on('viewFullSize', () => {
    window.open(`/images/fullsize/${pics[index].path}`, '_blank').focus()
  })
}
MainImage()

function Bookmarks () {
  $('#bookmarks button.remove').on('click', function () {
    const self = $(this).closest('.card')
    $.ajax({
      method: 'DELETE',
      url: self.data('link'),
      complete: () => self.remove()
    })
  })
  $('body').on('bookmark', () => {
    $.post('/api/bookmarks/add', { path: $('#mainImage img').data('path') })
    $('#mainMenu').trigger('hideMenu')
  }).on('markAllSeen', () => {
    $('div.modal .btn-primary').on('click', () => $.ajax({
      method: 'POST',
      url: '/api/mark/read',
      data: { path: picturereaderdata.path },
      complete: () => window.location.reload(true)
    }))
    $('div.modal').on('hidden.bs.modal', () => $('div.modal .btn-primary').off('click'))
    $('div.modal').modal('show')
  }).on('markAllUnseen', () => {
    $('div.modal .btn-primary').on('click', () => $.ajax({
      method: 'POST',
      url: '/api/mark/unread',
      data: { path: picturereaderdata.path },
      complete: () => window.location.reload(true)
    }))
    $('div.modal').on('hidden.bs.modal', () => $('div.modal .btn-primary').off('click'))
    $('div.modal').modal('show')
  })
}
Bookmarks()

function Folders () {
  $('body').on('nextFolder', () => {
    if (picturereaderdata.nextFolder) {
      window.location = picturereaderdata.nextFolder
    } else {
      $('#mainImage').trigger('error')
    }
  }).on('previousFolder', () => {
    if (picturereaderdata.previousFolder) {
      window.location = picturereaderdata.previousFolder
    } else {
      $('#mainImage').trigger('error')
    }
  }).on('parentFolder', () => {
    window.location = `/show${picturereaderdata.parent}`
  })
}
Folders()

function Navigation () {
  $('.action-button').click(function () {
    $(this).trigger($(this).data('action'))
  })
  $('#pictures .card').click(function () {
    $('#mainImage').trigger('loadIndex', [$(this).data('index')])
  })
  $('body').on('fullscreen', () => {
    if (!window.document.webkitFullscreenElement) {
      window.document.body.webkitRequestFullscreen()
    } else {
      window.document.webkitExitFullscreen()
    }
  })
  document.onkeyup = (evt) => {
    let keys = {
      ARROWUP: () => $('#mainMenu').trigger('showMenu'),
      ARROWDOWN: () => $('#mainMenu').trigger('hideMenu'),
      ARROWRIGHT: () => $('#mainImage').trigger('next'),
      ARROWLEFT: () => $('#mainImage').trigger('previous'),
      HOME: () => $('#mainImage').trigger('first'),
      END: () => $('#mainImage').trigger('last')
    }
    if ($('#mainMenu').is(':visible')) {
      keys = {
        ARROWDOWN: () => $('#mainMenu').trigger('hideMenu')
      }
    }
    var key = (evt.ctrlKey ? '<CTRL>' : '') +
        (evt.altKey ? '<ALT>' : '') +
        (evt.shiftKey ? '<SHIFT>' : '') +
        evt.key.toUpperCase()
    const action = keys[key] || (() => true)
    action()
  }

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
      $('#mainMenu').trigger('hideMenu')
      return
    }
    if (window.visualViewport && window.visualViewport.scale > initialScale) {
      return
    }
    const pageWidth = window.innerWidth || document.body.clientWidth
    const x = evt.pageX
    if (x < pageWidth / 3) {
      $('#mainImage').trigger('previous')
    } else if (x < pageWidth * 2 / 3) {
      $('#mainMenu').trigger('showMenu')
    } else {
      $('#mainImage').trigger('next')
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
          $('#mainImage').trigger('previous')
        } else {
          $('#mainImage').trigger('next')
        }
      }
      if (swipeVertical) {
        if (swipeY > 0) {
          $('#mainMenu').trigger('showMenu')
        }
      }
    } else {
      if (endTouch.screenX < pageWidth / 3) {
        // navigation.prevImage()
      } else if (endTouch.screenX < pageWidth * 2 / 3) {
        $('#mainMenu').trigger('showMenu')
      } else {
        // navigation.nextImage()
      }
    }
  }
}
Navigation()
