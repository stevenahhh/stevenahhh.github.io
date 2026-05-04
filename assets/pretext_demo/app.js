import { layoutWithLines, prepareWithSegments } from '/assets/js/pretext.js'

const FRAME_ID = 'pretext-demo-frame'
const text = 'Pretext는 브라우저 레이아웃 엔진을 다시 깨우지 않고도 문단을 얼마나 많은 줄로 접어야 하는지 계산할 수 있게 도와준다. 미리 준비한 세그먼트 폭을 바탕으로 폭이 바뀔 때마다 줄 수와 전체 높이를 다시 만든다. 그래서 텍스트가 많은 화면에서 리사이즈나 슬라이더 입력이 들어와도 DOM 박스를 재는 비용을 줄일 수 있다.'
const FONT = '500 15px "Pretendard Variable", -apple-system, BlinkMacSystemFont, sans-serif'
const LINE_HEIGHT = 26

const surface = document.getElementById('surface')
const widthRange = document.getElementById('widthRange')
const widthValue = document.getElementById('widthValue')
const lineCount = document.getElementById('lineCount')
const heightValue = document.getElementById('heightValue')
const measureCard = document.getElementById('measureCard')
const prepared = prepareWithSegments(text, FONT)

const lineNodes = []
let resizeFrame = null

const themeMedia = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => {
  document.documentElement.dataset.theme = themeMedia.matches ? 'dark' : 'light'
}

applyTheme()
themeMedia.addEventListener?.('change', applyTheme)

function ensureNodes(count) {
  while (lineNodes.length < count) {
    const line = document.createElement('div')
    line.className = 'render-line'
    surface.appendChild(line)
    lineNodes.push(line)
  }

  while (lineNodes.length > count) {
    const line = lineNodes.pop()
    line?.remove()
  }
}

function postParentHeight() {
  if (window.parent === window) {
    return
  }

  const nextHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    1,
  )

  window.parent.postMessage({
    type: 'pretext-demo-height',
    frameId: FRAME_ID,
    height: nextHeight,
  }, window.location.origin)
}

function requestParentHeightSync() {
  if (resizeFrame !== null) {
    window.cancelAnimationFrame(resizeFrame)
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null
    postParentHeight()
  })
}

function render(width) {
  const layout = layoutWithLines(prepared, width, LINE_HEIGHT)

  ensureNodes(layout.lines.length)

  layout.lines.forEach((line, index) => {
    const el = lineNodes[index]
    el.textContent = ''
    el.style.top = `${index * LINE_HEIGHT}px`
    el.textContent = line.text
  })

  surface.style.width = `${width}px`
  surface.style.height = `${layout.height}px`
  measureCard.style.width = `${width}px`
  widthValue.textContent = `${width}px`
  lineCount.textContent = `${layout.lines.length} lines`
  heightValue.textContent = `${layout.height}px`
  requestParentHeightSync()
}

widthRange.addEventListener('input', () => render(Number(widthRange.value)))
window.addEventListener('load', () => render(Number(widthRange.value)))
window.addEventListener('resize', requestParentHeightSync)

if ('ResizeObserver' in window) {
  const resizeObserver = new ResizeObserver(() => {
    requestParentHeightSync()
  })
  resizeObserver.observe(document.body)
}
