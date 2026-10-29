const INTENSITY = -2
const SECONDS_PER_SLIDE = 1.2
const AUTOPLAY_MS = 20000
const RIB_COUNT = 18
const RIB_LOW = 0.02
const RIB_HIGH = 0.3

const root = document.getElementById('kmg-slider')
const bgContainer = root.querySelector('.bg-container')
const canvas = root.querySelector('.gl-canvas')
const fallback = root.querySelector('.fallback')
const controlNav = root.querySelector('.control-nav')
const counter = root.querySelector('.pagination .current')
const slides = Array.from(root.querySelectorAll('.slide-content'))
const total = slides.length
const wrap = index => ((index % total) + total) % total

if (window.parent !== window) {
  document.documentElement.classList.add('is-embedded')
  const reportHeight = () => {
    window.parent.postMessage({ type: 'kmg-slider-height', height: root.offsetHeight }, window.location.origin)
  }
  new ResizeObserver(reportHeight).observe(root)
}

root.querySelector('.pagination .total').textContent = ` ${total}`

function buildNav(container, side) {
  const arrowPath = 'M23.528 11.685h-20M16.685 19.528l8-8-8-8'
  container.innerHTML = `
    <button class="nav-arrow" type="button" aria-label="${side === 'next' ? 'Next' : 'Previous'} slide">
      <span class="container-inner">
        <svg class="arrow" viewBox="0 0 28.214 23.057" aria-hidden="true"><g fill="none" stroke-linecap="square" stroke-width="1"><path d="${arrowPath}"></path></g></svg>
        <svg class="circle" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="1" stroke-linejoin="round" stroke-miterlimit="10"><circle cx="12" cy="12" r="10.5"></circle></g></svg>
      </span>
    </button>
    <div class="box-title"><h6></h6></div>`
  if (side === 'next') container.appendChild(container.querySelector('.nav-arrow'))
  return container.querySelector('h6')
}

const prevLabel = buildNav(root.querySelector('.prev-paginate'), 'prev')
const nextLabel = buildNav(root.querySelector('.next-paginate'), 'next')

const VERTEX_SHADER = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`

// Fragment shader from the theme's WebGLDistortionHoverEffects (horizontal mode).
// Both images are pushed sideways by the brightness of the displacement map,
// in opposite directions, while dispFactor crossfades between them.
const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D disp;
uniform float dispFactor;
uniform float effectFactor;
uniform vec4 resolution;
void main() {
  vec2 uv = (vUv - vec2(0.5)) * resolution.zw + vec2(0.5);
  vec4 d = texture2D(disp, uv);
  vec2 distortedPosition = vec2(uv.x + dispFactor * (d.r * effectFactor), uv.y);
  vec2 distortedPosition2 = vec2(uv.x - (1.0 - dispFactor) * (d.r * effectFactor), uv.y);
  vec4 t1 = texture2D(texture1, distortedPosition);
  vec4 t2 = texture2D(texture2, distortedPosition2);
  gl_FragColor = mix(t1, t2, dispFactor);
}`

// Fluted glass: every vertical rib is a ramp from RIB_LOW to RIB_HIGH, so each
// rib shifts its strip of the photo by a growing amount and the strip edges
// jump back at the next rib. The cosine ramp rounds the rib like a lens.
function makeDisplacementCanvas() {
  const width = 1024
  const map = document.createElement('canvas')
  map.width = width
  map.height = 4
  const context = map.getContext('2d')
  const ribWidth = width / RIB_COUNT
  for (let x = 0; x < width; x += 1) {
    const local = (x % ribWidth) / ribWidth
    const rounded = 0.5 - 0.5 * Math.cos(local * Math.PI)
    const value = Math.round((RIB_LOW + (RIB_HIGH - RIB_LOW) * rounded) * 255)
    context.fillStyle = `rgb(${value},${value},${value})`
    context.fillRect(x, 0, 1, map.height)
  }
  return map
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${src}`))
    image.src = src
  })
}

function createRenderer(images) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false })
  if (!gl) return null

  const compile = (type, source) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'shader compile failed')
    }
    return shader
  }

  const program = gl.createProgram()
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'program link failed')
  }
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  const makeTexture = source => {
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    return texture
  }

  const textures = images.map(makeTexture)
  const displacement = makeTexture(makeDisplacementCanvas())

  const uniforms = Object.fromEntries(
    ['texture1', 'texture2', 'disp', 'dispFactor', 'effectFactor', 'resolution'].map(name => [name, gl.getUniformLocation(program, name)]),
  )
  gl.uniform1i(uniforms.texture1, 0)
  gl.uniform1i(uniforms.texture2, 1)
  gl.uniform1i(uniforms.disp, 2)
  gl.uniform1f(uniforms.effectFactor, -INTENSITY)
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, displacement)

  const resize = () => {
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    gl.viewport(0, 0, canvas.width, canvas.height)
    const image = images[0]
    const imageAspect = image.naturalHeight / image.naturalWidth
    const cover = height / width > imageAspect ? [(width / height) * imageAspect, 1] : [1, height / width / imageAspect]
    gl.uniform4f(uniforms.resolution, width, height, cover[0], cover[1])
  }

  resize()

  return {
    resize,
    draw(from, to, amount) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, textures[from])
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, textures[to])
      gl.uniform1f(uniforms.dispFactor, amount)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
  }
}

function createFallback(sources) {
  root.classList.add('no-webgl')
  const images = sources.map(src => {
    const image = document.createElement('img')
    image.src = src
    image.alt = ''
    fallback.appendChild(image)
    return image
  })
  return {
    resize() {},
    draw(from, to, amount) {
      images.forEach((image, index) => {
        image.style.opacity = index === from ? String(1 - amount) : index === to ? String(amount) : '0'
      })
    },
  }
}

// The whole slider is one number. `position` 1.4 means "40% of the way from
// slide 1 to slide 2". Clicks only move `target`, so a click during a
// transition never restarts anything: the image keeps sliding from where it is.
let position = 0
let target = 0
let shownIndex = -1
let frame = 0
let lastTime = 0
let renderer = null
let autoplayTimer = 0

function showSlide(index) {
  if (index === shownIndex) return
  shownIndex = index
  slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index))
  counter.textContent = String(index + 1).padStart(2, '0')
  prevLabel.innerHTML = slides[wrap(index - 1)].querySelector('.title').innerHTML
  nextLabel.innerHTML = slides[wrap(index + 1)].querySelector('.title').innerHTML
  bgContainer.dataset.overlay = slides[index].dataset.overlay
}

function render() {
  const base = Math.floor(position)
  renderer?.draw(wrap(base), wrap(base + 1), position - base)
  showSlide(wrap(Math.round(position)))
}

function tick(now) {
  const seconds = Math.min(Math.max((now - lastTime) / 1000, 0), 0.1)
  lastTime = now
  const remaining = target - position
  if (Math.abs(remaining) < 1e-4) {
    position = target
    render()
    frame = 0
    return
  }
  const speed = Math.max(1, Math.abs(remaining)) / SECONDS_PER_SLIDE
  position += Math.sign(remaining) * Math.min(Math.abs(remaining), speed * seconds)
  render()
  frame = requestAnimationFrame(tick)
}

function animate() {
  if (frame) return
  lastTime = performance.now()
  frame = requestAnimationFrame(tick)
}

function stopAnimation() {
  cancelAnimationFrame(frame)
  frame = 0
}

function restartAutoplay() {
  window.clearTimeout(autoplayTimer)
  autoplayTimer = window.setTimeout(() => step(1), AUTOPLAY_MS)
}

function step(direction) {
  target += direction
  animate()
  restartAutoplay()
}

root.querySelector('.next-paginate .nav-arrow').addEventListener('click', () => step(1))
root.querySelector('.prev-paginate .nav-arrow').addEventListener('click', () => step(-1))

let drag = null

root.addEventListener('pointerdown', event => {
  if (!renderer || event.button !== 0 || event.target.closest('.nav-arrow')) return
  stopAnimation()
  target = position
  drag = { id: event.pointerId, x: event.clientX, time: performance.now(), start: position }
  root.setPointerCapture(event.pointerId)
  root.classList.add('is-dragging')
})

root.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return
  position = drag.start - (event.clientX - drag.x) / root.clientWidth
  target = position
  render()
})

function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return
  const moved = position - drag.start
  const quickSwipe = performance.now() - drag.time < 300 && Math.abs(moved) * root.clientWidth > 10
  drag = null
  root.classList.remove('is-dragging')
  if (quickSwipe) {
    target = moved > 0 ? Math.ceil(position) : Math.floor(position)
  } else {
    target = Math.round(position)
  }
  animate()
  restartAutoplay()
}

root.addEventListener('pointerup', endDrag)
root.addEventListener('pointercancel', endDrag)

let wheelLocked = false
root.addEventListener('wheel', event => {
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 6) return
  event.preventDefault()
  if (wheelLocked) return
  wheelLocked = true
  window.setTimeout(() => {
    wheelLocked = false
  }, 400)
  step(event.deltaX > 0 ? 1 : -1)
}, { passive: false })

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.clearTimeout(autoplayTimer)
    return
  }
  restartAutoplay()
})

window.addEventListener('resize', () => {
  renderer?.resize()
  render()
})

showSlide(0)

const sources = slides.map(slide => slide.dataset.src)
Promise.all(sources.map(loadImage))
  .then(images => {
    try {
      renderer = createRenderer(images)
    } catch (error) {
      console.error('WebGL slider failed, falling back to crossfade.', error)
      renderer = null
    }
    renderer ??= createFallback(sources)
  })
  .catch(error => {
    console.error(error)
    renderer = createFallback(sources)
  })
  .finally(() => {
    render()
    bgContainer.classList.add('is-ready')
    controlNav.classList.add('is-ready')
    restartAutoplay()
  })
