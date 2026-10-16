const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const jsQR = require('jsqr')
const { PNG } = require('pngjs')
const { generateQrTags } = require('../tools/generate-qr-tags')
const { QR_TAGS } = require('../miniprogram/utils/qr-tags')
const { validateQrResult } = require('../miniprogram/utils/qr-validation')

const originalPayloads = [
  'HRQ1|000|QR-START-A|9f4e8c2a7b1d6e3f5a0c9d8b7e6f1a2c',
  'HRQ1|001|QR-001-A|ced81f9f7eb9a66ad9e5bcd07d732613',
  'HRQ1|002|QR-002-A|6a75420f4b73f6b13b73679a280c0a2e',
  'HRQ1|003|QR-003-A|f8f3d159740d3cf8104f3aa5618302e6',
  'HRQ1|999|QR-FINISH-A|3c7a1e9b5d2f8a604e1c9b7d3f5a2e8c'
]
const labels = ['起点', '打卡点1', '打卡点2', '打卡点3', '终点']
const hint = '请在微信小程序「悠湃体育」内点击“扫码打卡”使用。'

async function verifyFiles(files) {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const tag = QR_TAGS[index]
    const expected = `${hint}\n${originalPayloads[index]}`
    const image = PNG.sync.read(await fs.readFile(file.imagePath))
    const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height)
    assert.ok(decoded, `Readable PNG: ${file.imagePath}`)
    assert.equal(decoded.data, expected)
    assert.equal(await fs.readFile(file.textPath, 'utf8'), expected)
    assert.equal(image.width, image.height)
    assert.equal(tag.legacyPayload, originalPayloads[index])
    assert.equal(tag.payload, expected)
    const result = validateQrResult({
      expectedCheckpointType: tag.checkpointType,
      expectedStationIndex: tag.stationIndex,
      result: { result: decoded.data }, qrTags: QR_TAGS
    })
    assert.equal(result.ok, true)
    assert.equal(result.pointCode, file.pointCode)
  }
}

async function main() {
  const root = path.resolve(__dirname, '..')
  const files = labels.map((label, index) => ({
    pointCode: QR_TAGS[index].pointCode,
    imagePath: path.join(root, 'assets', 'qr-checkpoints', `${label}.png`),
    textPath: path.join(root, 'assets', 'qr-checkpoints', `${label}.txt`)
  }))
  await verifyFiles(files)
  console.log('PASS five delivered PNGs decode to the exact Chinese guidance and original point data')

  const temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'health-run-qr-guidance-'))
  try {
    const guidePath = path.join(temporaryDir, 'qr-payloads.md')
    const generated = await generateQrTags({ outputDir: temporaryDir, guidePath })
    assert.equal(generated.length, 5)
    await verifyFiles(generated)
    const guide = await fs.readFile(guidePath, 'utf8')
    for (const tag of QR_TAGS) assert.ok(guide.includes(tag.payload))
    console.log('PASS generator reproduces five readable codes and matching printing instructions')
  } finally {
    await fs.rm(temporaryDir, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
