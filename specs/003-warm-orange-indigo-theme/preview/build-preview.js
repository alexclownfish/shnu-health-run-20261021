const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../../..')
const mini = path.join(root, 'miniprogram')
const pages = ['route', 'checkin', 'upload', 'certificate', 'records', 'profile']
const sources = [path.join(mini, 'app.wxss'), ...pages.map((page) => path.join(mini, 'pages', page, `${page}.wxss`))]
const styles = sources.map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
  .replace(/\bpage\s*\{/, '.snapshot {')
  .replace(/(-?\d*\.?\d+)rpx\b/g, (_, number) => `${Number(number) / 2}px`)
  .replace(/letter-spacing:\s*[^;]+;/g, 'letter-spacing: 0;')

const route = require(path.join(mini, 'utils', 'route.js'))
const stations = require(path.join(mini, 'utils', 'stations.js'))
const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8')
const script = fs.readFileSync(path.join(__dirname, 'preview.js'), 'utf8')
const replaceLiteral = (source, marker, value) => source.replace(marker, () => value)
const html = replaceLiteral(
  replaceLiteral(
    replaceLiteral(
      replaceLiteral(
        replaceLiteral(template, '/* SOURCE_STYLES */', styles),
        '/* PREVIEW_STYLES */',
        fs.readFileSync(path.join(__dirname, 'theme.css'), 'utf8')
      ),
      '/* LUCIDE_SOURCE */',
      fs.readFileSync(path.join(root, 'ui-prototype', 'assets', 'lucide.min.js'), 'utf8')
    ),
    '/* PREVIEW_DATA */',
    `const previewData = ${JSON.stringify({
    stations: stations.map(({ id, title, location, distance, sourceMarker, tag }) => ({ id, title, location, distance, sourceMarker, tag })),
    points: route.getMapPoints(),
    segments: route.getMapSegments(),
    markers: route.getMapMarkers(),
    taskDistances: route.TASK_DISTANCE_KM,
    totalDistance: route.TOTAL_DISTANCE_KM
  })};`
  ),
  '/* PREVIEW_SCRIPT */',
  script
)
fs.writeFileSync(path.join(__dirname, 'index.html'), html)
console.log('Built self-contained preview/index.html from current page styles. Production files are unchanged.')
