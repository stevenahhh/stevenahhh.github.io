const INTENSITY = -2
const TRANSITION_SECONDS = 1.6
const AUTOPLAY_MS = 20000
const NAV_SPEED_MS = 1000
const DRAG_SPEED_SECONDS = 0.3

const root = document.getElementById('kmg-slider')
const bgContainer = root.querySelector('.bg-container')
const canvas = root.querySelector('.gl-canvas')
const fallback = root.querySelector('.fallback')
const controlNav = root.querySelector('.control-nav')
const counter = root.querySelector('.pagination .current')
const slides = Array.from(root.querySelectorAll('.slide-content'))
const total = slides.length

if (window.parent !== window) {
  document.documentElement.classList.add('is-embedded')
  const reportHeight = () => {
    window.parent.postMessage({ type: 'kmg-slider-height', height: root.offsetHeight }, window.location.origin)
  }
  new ResizeObserver(reportHeight).observe(root)
}

root.querySelector('.pagination .total').textContent = ` ${total}`

const ease = {
  expoOut: p => (p === 1 ? 1 : 1 - 2 ** (-10 * p)),
  backIn: overshoot => p => p * p * ((overshoot + 1) * p - overshoot),
  backOut: overshoot => p => {
    const q = p - 1
    return q * q * ((overshoot + 1) * q + overshoot) + 1
  },
}

function tween({ from, to, seconds, easing, onUpdate, onComplete }) {
  let frame = 0
  let done = false
  const start = performance.now()
  const step = now => {
    const progress = Math.min((now - start) / (seconds * 1000), 1)
    onUpdate(from + (to - from) * easing(progress))
    if (progress < 1) {
      frame = requestAnimationFrame(step)
      return
    }
    done = true
    onComplete?.()
  }
  frame = requestAnimationFrame(step)
  return {
    kill() {
      cancelAnimationFrame(frame)
      done = true
    },
    get active() {
      return !done
    },
  }
}

function splitChars(element) {
  const chars = []
  const nodes = Array.from(element.childNodes)
  element.textContent = ''
  for (const node of nodes) {
    if (node.nodeType !== Node.TEXT_NODE) {
      element.appendChild(node)
      continue
    }
    const parts = node.textContent.split(/(\s+)/)
    for (const part of parts) {
      if (!part) continue
      if (/^\s+$/.test(part)) {
        element.appendChild(document.createTextNode(' '))
        continue
      }
      const word = document.createElement('span')
      word.className = 'word'
      for (const letter of part) {
        const char = document.createElement('span')
        char.className = 'char'
        char.textContent = letter
        word.appendChild(char)
        chars.push(char)
      }
      element.appendChild(word)
    }
  }
  return chars
}

slides.forEach(slide => {
  const title = slide.querySelector('.title')
  title.dataset.label = title.innerHTML
})

const titleChars = slides.map(slide => splitChars(slide.querySelector('.title')))

// GSAP `stagger: { amount, from: "center" }`: delay grows linearly with the
// distance from the middle item, and the farthest item starts `amount` late.
function centerStagger(count, amount) {
  const middle = (count - 1) / 2
  return Array.from({ length: count }, (_, index) => (middle === 0 ? 0 : (Math.abs(index - middle) / middle) * amount))
}

function applyCharState(char, state) {
  char.style.opacity = String(state.opacity)
  char.style.visibility = state.opacity <= 0 ? 'hidden' : 'inherit'
  char.style.transform = `translate(0, ${state.y}%) rotate(${state.rotation}deg) scale(${state.scale})`
}

function lerpState(from, to, amount) {
  return {
    opacity: from.opacity + (to.opacity - from.opacity) * amount,
    y: from.y + (to.y - from.y) * amount,
    rotation: from.rotation + (to.rotation - from.rotation) * amount,
    scale: from.scale + (to.scale - from.scale) * amount,
  }
}

function createTextTimeline(oldChars, newChars, movingForward, onSwap) {
  const shown = { opacity: 1, y: 0, rotation: 0, scale: 1 }
  const hidden = { opacity: 0, y: movingForward ? -25 : 25, rotation: 8, scale: 1.1 }
  const hideTrack = { chars: oldChars, from: shown, to: hidden, seconds: 0.4, easing: ease.backIn(4), delays: centerStagger(oldChars.length, 0.3), offset: 0 }
  const hideEnd = 0.4 + (oldChars.length > 1 ? 0.3 : 0)
  const showTrack = { chars: newChars, from: hidden, to: shown, seconds: 0.8, easing: ease.backOut(4), delays: centerStagger(newChars.length, 0.3), offset: hideEnd - 0.005 }
  const end = showTrack.offset + 0.8 + (newChars.length > 1 ? 0.3 : 0)

  let swapped = false
  let frame = 0
  let finished = false
  const start = performance.now()

  const render = elapsed => {
    if (!swapped && elapsed >= hideEnd) {
      swapped = true
      onSwap()
    }
    for (const track of [hideTrack, showTrack]) {
      if (track === showTrack && !swapped) continue
      track.chars.forEach((char, index) => {
        const local = (elapsed - track.offset - track.delays[index]) / track.seconds
        const progress = Math.min(Math.max(local, 0), 1)
        applyCharState(char, lerpState(track.from, track.to, track.easing(progress)))
      })
    }
  }

  const step = now => {
    const elapsed = (now - start) / 1000
    render(Math.min(elapsed, end))
    if (elapsed < end) {
      frame = requestAnimationFrame(step)
      return
    }
    finished = true
  }

  frame = requestAnimationFrame(step)

  return {
    get active() {
      return !finished
    },
    finish() {
      if (finished) return
      cancelAnimationFrame(frame)
      render(end)
      finished = true
    },
  }
}

function buildNav(container, side) {
  const arrowPath = 'M23.528 11.685h-20M16.685 19.528l8-8-8-8'
  const navSlides = slides.map((_, index) => {
    const targetIndex = side === 'next' ? (index + 1) % total : (index - 1 + total) % total
    const titleHtml = slides[targetIndex].querySelector('.title').dataset.label
    const slide = document.createElement('div')
    slide.className = 'nav-slide'
    slide.innerHTML = `
      <button class="nav-arrow" type="button" aria-label="${side === 'next' ? '다음' : '이전'} 슬라이드">
        <span class="container-inner">
          <svg class="arrow" viewBox="0 0 28.214 23.057" aria-hidden="true"><g fill="none" stroke-linecap="square" stroke-width="1"><path d="${arrowPath}"></path></g></svg>
          <svg class="circle" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="1" stroke-linejoin="round" stroke-miterlimit="10"><circle cx="12" cy="12" r="10.5"></circle></g></svg>
        </span>
      </button>
      <div class="box-title"><h6>${titleHtml}</h6></div>`
    if (side === 'next') slide.appendChild(slide.querySelector('.nav-arrow'))
    container.appendChild(slide)
    return slide
  })

  // Same data-swiper-parallax values the theme writes onto every split char:
  // the n-th char travels (n + 5) * 9 % of its height in (n + 5) * 100 ms.
  const parallaxItems = []
  navSlides.forEach(slide => {
    const chars = splitChars(slide.querySelector('h6'))
    const arrow = slide.querySelector('.nav-arrow')
    chars.forEach((char, index) => {
      parallaxItems.push({ slide, el: char, y: (index + 5) * 9, duration: (index + 5) * 100 })
    })
    if (side === 'next') {
      const step = chars.length + 4
      parallaxItems.push({ slide, el: arrow, y: step * 3, duration: step * 100 })
    } else {
      parallaxItems.push({ slide, el: arrow, y: 12, duration: null })
    }
  })

  return {
    setActive(activeIndex, animate) {
      navSlides.forEach((slide, index) => {
        const progress = Math.min(Math.max(activeIndex - index, -1), 1)
        slide.style.transition = `opacity ${animate ? NAV_SPEED_MS : 0}ms ease`
        slide.style.opacity = String(1 + Math.min(progress, 0))
        slide.style.zIndex = String(total - Math.abs(activeIndex - index))
        slide.classList.toggle('is-active', index === activeIndex)
        slide.setAttribute('aria-hidden', String(index !== activeIndex))
        slide.querySelector('.nav-arrow').tabIndex = index === activeIndex ? 0 : -1
      })
      const parallaxEnabled = window.innerWidth > 575
      for (const item of parallaxItems) {
        const progress = Math.min(Math.max(activeIndex - navSlides.indexOf(item.slide), -1), 1)
        const duration = animate ? (item.duration ?? NAV_SPEED_MS) : 0
        item.el.style.transitionDuration = `${duration}ms`
        item.el.style.transform = parallaxEnabled ? `translate3d(0, ${item.y * progress}%, 0)` : ''
        item.el.style.opacity = String(1 - Math.abs(progress))
      }
    },
  }
}

const prevNav = buildNav(root.querySelector('.prev-paginate'), 'prev')
const nextNav = buildNav(root.querySelector('.next-paginate'), 'next')

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

function makeDisplacementCanvas() {
  const columns = 48
  const rows = 30
  const cell = 11
  const map = document.createElement('canvas')
  map.width = columns * cell
  map.height = rows * cell
  const context = map.getContext('2d')
  let seed = 7
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const gray = () => {
    const pick = random()
    if (pick < 0.7) return 75 + random() * 80
    if (pick < 0.9) return 26 + random() * 50
    return 205 + random() * 30
  }
  const fill = (points, value) => {
    context.fillStyle = `rgb(${value},${value},${value})`
    context.beginPath()
    context.moveTo(points[0], points[1])
    context.lineTo(points[2], points[3])
    context.lineTo(points[4], points[5])
    context.closePath()
    context.fill()
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * cell
      const y = row * cell
      const x2 = x + cell
      const y2 = y + cell
      if (random() < 0.5) {
        fill([x, y, x2, y, x, y2], gray())
        fill([x2, y, x2, y2, x, y2], gray())
      } else {
        fill([x, y, x2, y, x2, y2], gray())
        fill([x, y, x2, y2, x, y2], gray())
      }
    }
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
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, displacement)

  const state = { from: 0, to: 0, dispFactor: 0, effectFactor: INTENSITY, coverIndex: 0 }

  const resize = () => {
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    gl.viewport(0, 0, canvas.width, canvas.height)
    const image = images[state.coverIndex]
    const imageAspect = image.naturalHeight / image.naturalWidth
    const cover = height / width > imageAspect ? [(width / height) * imageAspect, 1] : [1, height / width / imageAspect]
    gl.uniform4f(uniforms.resolution, width, height, cover[0], cover[1])
    render()
  }

  const render = () => {
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, textures[state.from])
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, textures[state.to])
    gl.uniform1f(uniforms.dispFactor, state.dispFactor)
    gl.uniform1f(uniforms.effectFactor, state.effectFactor)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  window.addEventListener('resize', resize)
  resize()

  return {
    set(from, to, dispFactor) {
      state.from = from
      state.to = to
      state.dispFactor = dispFactor
      state.effectFactor = to > from ? -1 * INTENSITY : INTENSITY
      if (state.coverIndex !== to) {
        state.coverIndex = to
        resize()
        return
      }
      render()
    },
  }
}

function createFallback(sources) {
  root.classList.add('no-webgl')
  const images = sources.map((src, index) => {
    const image = document.createElement('img')
    image.src = src
    image.alt = ''
    image.classList.toggle('is-active', index === 0)
    fallback.appendChild(image)
    return image
  })
  return {
    set(_from, to, dispFactor) {
      if (dispFactor < 1 && dispFactor > 0) return
      images.forEach((image, index) => image.classList.toggle('is-active', index === to))
    },
  }
}

let activeIndex = 0
let textTimeline = null
let imageTween = null
let renderer = null
let autoplayTimer = 0

function restartAutoplay() {
  window.clearTimeout(autoplayTimer)
  autoplayTimer = window.setTimeout(() => {
    goTo(activeIndex + 1 >= total ? 0 : activeIndex + 1)
  }, AUTOPLAY_MS)
}

function animateImage(from, to, startDisp) {
  imageTween?.kill()
  bgContainer.dataset.overlay = slides[to].dataset.overlay
  renderer.set(from, to, startDisp)
  imageTween = tween({
    from: startDisp,
    to: 1,
    seconds: TRANSITION_SECONDS,
    easing: ease.expoOut,
    onUpdate: value => renderer.set(from, to, value),
  })
}

function goTo(nextIndex, startDisp = 0) {
  if (nextIndex === activeIndex) return
  const previousIndex = activeIndex
  activeIndex = nextIndex

  const oldSlide = slides[previousIndex]
  const newSlide = slides[nextIndex]
  counter.textContent = String(nextIndex + 1).padStart(2, '0')

  if (renderer) animateImage(previousIndex, nextIndex, startDisp)

  textTimeline?.finish()
  oldSlide.classList.remove('dsn-active-animate')
  textTimeline = createTextTimeline(titleChars[previousIndex], titleChars[nextIndex], previousIndex < nextIndex, () => {
    oldSlide.classList.remove('dsn-active')
    newSlide.classList.add('dsn-active', 'dsn-active-animate')
  })

  prevNav.setActive(nextIndex, true)
  nextNav.setActive(nextIndex, true)
  restartAutoplay()
}

function handleNext() {
  if (textTimeline?.active) return
  goTo(activeIndex + 1 >= total ? 0 : activeIndex + 1)
}

function handlePrev() {
  if (textTimeline?.active) return
  goTo(activeIndex === 0 ? total - 1 : activeIndex - 1)
}

root.querySelector('.next-paginate').addEventListener('click', event => {
  if (event.target.closest('.nav-arrow')) handleNext()
})
root.querySelector('.prev-paginate').addEventListener('click', event => {
  if (event.target.closest('.nav-arrow')) handlePrev()
})

let drag = null

root.addEventListener('pointerdown', event => {
  if (!renderer || event.button !== 0 || event.target.closest('.nav-arrow')) return
  drag = { id: event.pointerId, x: event.clientX, time: performance.now(), target: null, amount: 0 }
  root.setPointerCapture(event.pointerId)
  root.classList.add('is-dragging')
})

root.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return
  const dx = event.clientX - drag.x
  const target = dx < 0 ? activeIndex + 1 : activeIndex - 1
  if (Math.abs(dx) < 4 || target < 0 || target >= total) {
    if (drag.target !== null) renderer.set(activeIndex, drag.target, 0)
    drag.target = null
    drag.amount = 0
    return
  }
  imageTween?.kill()
  drag.target = target
  drag.amount = Math.min(Math.abs(dx) / root.clientWidth, 1)
  renderer.set(activeIndex, target, drag.amount)
})

function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return
  const { target, amount, time } = drag
  const distance = amount * root.clientWidth
  drag = null
  root.classList.remove('is-dragging')
  if (target === null) return
  const quickSwipe = performance.now() - time < 300 && distance > 10
  if (quickSwipe || amount > 0.5) {
    goTo(target, amount)
    return
  }
  const from = activeIndex
  imageTween?.kill()
  imageTween = tween({
    from: amount,
    to: 0,
    seconds: DRAG_SPEED_SECONDS,
    easing: ease.expoOut,
    onUpdate: value => renderer.set(from, target, value),
  })
}

root.addEventListener('pointerup', endDrag)
root.addEventListener('pointercancel', endDrag)

let wheelLocked = false
root.addEventListener('wheel', event => {
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 6) return
  event.preventDefault()
  if (wheelLocked) return
  const target = event.deltaX > 0 ? activeIndex + 1 : activeIndex - 1
  if (target < 0 || target >= total) return
  wheelLocked = true
  window.setTimeout(() => {
    wheelLocked = false
  }, TRANSITION_SECONDS * 1000)
  goTo(target)
}, { passive: false })

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.clearTimeout(autoplayTimer)
    return
  }
  restartAutoplay()
})

window.addEventListener('resize', () => {
  prevNav.setActive(activeIndex, false)
  nextNav.setActive(activeIndex, false)
})

prevNav.setActive(0, false)
nextNav.setActive(0, false)

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
    bgContainer.classList.add('is-ready')
    controlNav.classList.add('is-ready')
    restartAutoplay()
  })
