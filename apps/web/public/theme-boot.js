/*
 * Applies a stored explicit theme before the first paint, so a light or
 * dark choice never flashes the other theme. External file (not inline) so
 * the CSP can stay `script-src 'self'`. No stored choice = follow the device
 * (prefers-color-scheme in src/styles.css).
 */
;(function () {
  var preference = null
  try {
    preference = window.localStorage.getItem('mt:theme')
  } catch (error) {
    preference = null
  }
  if (preference === 'light' || preference === 'dark') {
    document.documentElement.setAttribute('data-theme', preference)
  }
})()
