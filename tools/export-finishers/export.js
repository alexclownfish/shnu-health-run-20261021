const ExcelJS = require('exceljs')
const { checkConfig, validStoredRecord } = require('../../cloudfunctions/submitCompletion/policy')

function duration(ms) {
  const seconds = Math.floor(ms / 1000)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`
}

function localTime(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(ms))
  const value = (name) => parts.find((part) => part.type === name).value
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`
}

async function collectRows(fetchPage, config, cutoff, pageSize = 100) {
  if (!checkConfig(config).ok || !Number.isSafeInteger(cutoff) || cutoff <= 0) throw new Error('INVALID_EXPORT_CONFIG')
  const rows = []
  const seen = new Set()
  let cursor = ''
  let examined = 0
  let excluded = 0
  while (true) {
    const page = await fetchPage({ activityId: config.activityId, cutoff, cursor, limit: pageSize })
    if (!Array.isArray(page) || page.length > pageSize) throw new Error('INVALID_EXPORT_PAGE')
    if (!page.length) break
    let previous = cursor
    for (const record of page) {
      if (!record || typeof record._id !== 'string' || record._id <= previous) throw new Error('UNSTABLE_EXPORT_CURSOR')
      previous = record._id
      examined += 1
      if (!validStoredRecord(record, config, cutoff) || seen.has(record.ownerOpenId)) {
        excluded += 1
        continue
      }
      seen.add(record.ownerOpenId)
      rows.push(record)
    }
    cursor = previous
    if (page.length < pageSize) break
  }
  rows.sort((left, right) => left.completedAt - right.completedAt || left._id.localeCompare(right._id))
  return { rows, examined, excluded }
}

function createWorkbook(result, config, cutoff, options = {}) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Health Run'
  const timeZone = config.timeZone || 'Asia/Shanghai'
  const sheet = workbook.addWorksheet(config.mode === 'production' ? '完赛名单' : '测试名单')
  sheet.columns = [
    { header: '序号', key: 'number', width: 8 },
    { header: '活动名称', key: 'title', width: 24 },
    { header: '活动编号', key: 'activityId', width: 28 },
    { header: '路线版本', key: 'routeVersion', width: 22 },
    { header: '参与者编号', key: 'participantId', width: 22 },
    { header: '微信昵称', key: 'nickName', width: 22 },
    { header: '起点时间', key: 'startedAt', width: 24 },
    { header: '完成时间', key: 'completedAt', width: 24 },
    { header: '总用时', key: 'duration', width: 16 },
    { header: '完成任务点数量', key: 'points', width: 20 },
    { header: '接收时间', key: 'receivedAt', width: 24 }
  ]
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  result.rows.forEach((row, index) => sheet.addRow({
    number: index + 1,
    title: String(config.title), activityId: String(row.activityId), routeVersion: String(row.routeVersion),
    participantId: String(row.participantId), nickName: String(row.nickName || '未填写昵称'),
    startedAt: localTime(row.startedAt, timeZone), completedAt: localTime(row.completedAt, timeZone),
    duration: duration(row.durationMs), points: row.completedPointCodes.length,
    receivedAt: localTime(row.receivedAt, timeZone)
  }))
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F4B9F' } }
  sheet.autoFilter = { from: 'A1', to: 'K1' }
  const notes = workbook.addWorksheet('导出说明')
  notes.columns = [{ width: 26 }, { width: 100 }]
  notes.addRows([
    ['数据环境', config.mode === 'production' ? '正式活动' : '测试数据（不可作为正式名单）'],
    ['活动编号', config.activityId], ['路线版本', config.routeVersion],
    ['导出类型', options.preview ? '进行中预览，存在尚未收到及处理中记录' : '补交窗口关闭后的名单'],
    ['有效记录数', result.rows.length], ['检查记录数', result.examined], ['排除异常记录数', result.excluded],
    ['接收截止时间', localTime(cutoff, timeZone)], ['时区', timeZone],
    ['口径', '已收到的本机自报完赛记录；未补交、未联网人员可能不在名单中。'],
    ['计时', '手机起止时间差；不用于可信考勤、防作弊或排名。'],
    ['数据来源', options.local ? '控制台导出文件本地转换；未查询云端，不代表文件之外的记录已完整导出。' : '管理员权限查询云数据库']
  ])
  return workbook
}

module.exports = { collectRows, createWorkbook, duration, localTime }
