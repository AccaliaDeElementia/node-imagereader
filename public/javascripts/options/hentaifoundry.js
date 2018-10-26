'use sanity'

/* global $ */

const me = $(document.currentScript).closest('.container')

$(me).find('form').on('submit', () => {
  const user = me.find('input[name=userToAdd]').val()
  $.ajax({
    method: 'PUT',
    url: `${window.location.pathname}/${user}`,
    complete: () => {
      window.location = `${window.location.pathname}#${user}`
      window.location.reload()
    }
  })
  return false
})

function manipulateUser (selector, method, pathext = '') {
  me.find(selector).on('click', (evt) => {
    const user = $(evt.target).data('name')
    $.ajax({
      method: method,
      url: `${window.location.pathname}/${user}/${pathext}`,
      complete: () => {
        window.location = `${window.location.pathname}#${user}`
        window.location.reload()
      }
    })
  })
}

manipulateUser('.delete-user', 'DELETE')
manipulateUser('.activate-user', 'PATCH', 'activate')
manipulateUser('.deactivate-user', 'PATCH', 'deactivate')

if (window.location.hash) {
  me.find(window.location.hash).addClass('active')
}
