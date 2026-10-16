const QR_USAGE_HINT = '请在微信小程序「悠湃体育」内点击“扫码打卡”使用。'

const QR_TAGS = [
  {
    qrId: 'QR-START-A',
    qrToken: '9f4e8c2a7b1d6e3f5a0c9d8b7e6f1a2c',
    pointCode: '000',
    checkpointType: 'start',
    checkpointIndex: -1,
    payloadVersion: 1,
    enabled: true
  },
  {
    qrId: 'QR-001-A',
    qrToken: 'ced81f9f7eb9a66ad9e5bcd07d732613',
    pointCode: '001',
    checkpointType: 'station',
    checkpointIndex: 0,
    stationIndex: 0,
    payloadVersion: 1,
    enabled: true
  },
  {
    qrId: 'QR-002-A',
    qrToken: '6a75420f4b73f6b13b73679a280c0a2e',
    pointCode: '002',
    checkpointType: 'station',
    checkpointIndex: 1,
    stationIndex: 1,
    payloadVersion: 1,
    enabled: true
  },
  {
    qrId: 'QR-003-A',
    qrToken: 'f8f3d159740d3cf8104f3aa5618302e6',
    pointCode: '003',
    checkpointType: 'station',
    checkpointIndex: 2,
    stationIndex: 2,
    payloadVersion: 1,
    enabled: true
  },
  {
    qrId: 'QR-FINISH-A',
    qrToken: '3c7a1e9b5d2f8a604e1c9b7d3f5a2e8c',
    pointCode: '999',
    checkpointType: 'finish',
    checkpointIndex: 3,
    payloadVersion: 1,
    enabled: true
  }
].map((item) => {
  const legacyPayload = `HRQ${item.payloadVersion}|${item.pointCode}|${item.qrId}|${item.qrToken}`
  return { ...item, legacyPayload, payload: `${QR_USAGE_HINT}\n${legacyPayload}` }
})

function hasDuplicates(values) {
  return new Set(values).size !== values.length
}

function getQrInventoryStatus(qrTags = QR_TAGS) {
  const enabled = (Array.isArray(qrTags) ? qrTags : []).filter((item) => item && item.enabled !== false)
  const invalid = enabled.filter((item) => (
    !/^\d{3}$/.test(item.pointCode) ||
    !/^QR-[A-Z0-9-]{1,24}$/.test(item.qrId) ||
    !/^[A-Za-z0-9_-]{22,64}$/.test(item.qrToken) ||
    item.payloadVersion !== 1 ||
    item.legacyPayload !== `HRQ1|${item.pointCode}|${item.qrId}|${item.qrToken}` ||
    item.payload !== `${QR_USAGE_HINT}\n${item.legacyPayload}` ||
    !['start', 'station', 'finish'].includes(item.checkpointType) ||
    !Number.isInteger(item.checkpointIndex) ||
    (item.checkpointType === 'station' && (!Number.isInteger(item.stationIndex) ||
      item.stationIndex < 0 || item.stationIndex > 2 || item.checkpointIndex !== item.stationIndex ||
      item.pointCode !== String(item.stationIndex + 1).padStart(3, '0'))) ||
    (item.checkpointType === 'start' && (item.pointCode !== '000' || item.checkpointIndex !== -1 || 'stationIndex' in item)) ||
    (item.checkpointType === 'finish' && (item.pointCode !== '999' || item.checkpointIndex !== 3 || 'stationIndex' in item))
  ))
  return {
    releaseReady: enabled.length === 5 &&
      invalid.length === 0 &&
      !hasDuplicates(enabled.map((item) => item.pointCode)) &&
      !hasDuplicates(enabled.map((item) => item.checkpointIndex)) &&
      !hasDuplicates(enabled.map((item) => item.qrId)) &&
      !hasDuplicates(enabled.map((item) => item.qrToken)) &&
      !hasDuplicates(enabled.map((item) => item.payload)),
    invalidQrIds: invalid.map((item) => item.qrId)
  }
}

module.exports = {
  QR_TAGS,
  QR_USAGE_HINT,
  getQrInventoryStatus
}
