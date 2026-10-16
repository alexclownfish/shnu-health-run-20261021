const fs = require('node:fs/promises')
const path = require('node:path')
const { checkConfig } = require('../../cloudfunctions/submitCompletion/policy')
const { collectRows, createWorkbook } = require('./export')
const { readRecords, collectLocalRows } = require('./local')
class ExportInputError extends Error {}
class ExportOperationError extends Error {
  constructor(stage, cause) {
    super('EXPORT_OPERATION_FAILED')
    this.stage = stage
    this.cause = cause
  }
}

async function atStage(stage, operation) {
  try { return await operation() } catch (error) { throw new ExportOperationError(stage, error) }
}

function credentialsFrom(environment = process.env) {
  // Explicit Tencent credentials take precedence over a leftover API key in the shell.
  if (environment.TENCENTCLOUD_SECRETID || environment.TENCENTCLOUD_SECRETKEY) {
    if (!environment.TENCENTCLOUD_SECRETID || !environment.TENCENTCLOUD_SECRETKEY) {
      throw new ExportInputError('腾讯云 SecretId 和 SecretKey 必须同时配置。')
    }
    return { secretId: environment.TENCENTCLOUD_SECRETID, secretKey: environment.TENCENTCLOUD_SECRETKEY,
      sessionToken: environment.TENCENTCLOUD_SESSIONTOKEN }
  }
  if (environment.CLOUDBASE_APIKEY) return { accessKey: environment.CLOUDBASE_APIKEY }
  throw new ExportInputError('未配置管理员凭据。不得将凭据写入小程序或仓库。')
}

function describeError(error, environment = process.env) {
  if (error instanceof ExportInputError) return error.message
  const cause = error instanceof ExportOperationError ? error.cause : error
  const stage = error instanceof ExportOperationError ? error.stage : '导出'
  const code = cause && cause.code !== undefined ? String(cause.code) : ''
  const message = cause && typeof cause.message === 'string' ? cause.message : ''
  const signals = `${code} ${message}`
  let advice = '请根据失败阶段检查配置；云端失败时核对管理员账号与目标环境。'
  if (code === 'EEXIST') advice = '输出文件已存在，请换一个文件名；已有文件不会被覆盖。'
  else if (/^LOCAL_JSON/.test(code)) advice = '输入文件不是支持的 JSON 数据，请选择 JSON 数组或每行一条完整 JSON 记录；解析失败时不会生成 Excel。'
  else if (code === 'LOCAL_FILE_FORMAT') advice = '请使用控制台导出的 .json/.jsonl/.ndjson 文件；压缩包先解压，CSV 请重新导出为 JSON。'
  else if (code === 'LOCAL_FILE_TOO_LARGE') advice = '当前本地转换支持最多 50 MB，请按活动拆分导出文件。'
  else if (cause instanceof SyntaxError && stage === '读取活动配置') advice = '活动配置不是有效 JSON，请检查引号、逗号和文件内容。'
  else if (code === 'ENOENT') advice = '文件或目录不存在，请检查配置路径和输出目录。'
  else if (['EACCES', 'EPERM', 'EROFS'].includes(code)) advice = '本地文件权限不足，请检查配置文件和输出目录权限。'
  else if (code === 'ENOSPC') advice = '磁盘空间不足，请释放空间后重试。'
  else if (/index|索引/i.test(signals)) advice = '数据库查询涉及索引错误。请在开发环境检查 activityId、receivedAt 和 _id 分页排序的索引要求。'
  else if (/signature|credential|secretid|secretkey|invalid.?token|token.?expired|authfailure|invalid.?access.?key|鉴权|签名|密钥/i.test(signals)) {
    advice = '云端鉴权失败。请确认使用目标环境所属腾讯云账号的 API 密钥；不是小程序 AppSecret。临时密钥需同时设置有效 SessionToken，并检查电脑时间。'
  } else if (/permission|unauthorized|access.?denied|forbidden|not.?authorized|权限|无权/i.test(signals)) {
    advice = '云端权限不足。请确认密钥所属账号有该环境数据库读取权限；不要开放小程序客户端读权限。'
  } else if (/INVALID_ENV|env.*(not.*found|not.*exist|invalid)|环境.*(不存在|无效)/i.test(signals)) {
    advice = '无法访问指定云环境，请核对环境 ID、账号归属及环境状态。也可从云控制台导出 JSON 后使用 --input 本地转换，无需管理员密钥。'
  } else if (/collection.*(not.*found|not.*exist)|集合.*不存在/i.test(signals)) {
    advice = '目标集合不存在，请确认目标云环境中已建立 finishers。'
  } else if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timeout|network|socket|certificate/i.test(signals)) {
    advice = '网络连接失败，请检查网络、代理和证书后重试。'
  } else if (/UNSTABLE_EXPORT_CURSOR|INVALID_EXPORT_PAGE/.test(signals)) {
    advice = '数据库分页结果异常，已停止导出以避免名单遗漏，请核对查询与 SDK 返回结构。'
  }
  const secrets = ['TENCENTCLOUD_SECRETID', 'TENCENTCLOUD_SECRETKEY', 'TENCENTCLOUD_SESSIONTOKEN', 'CLOUDBASE_APIKEY']
    .map((key) => environment[key]).filter(Boolean)
  const safeCode = /^[-A-Za-z0-9_.]{1,80}$/.test(code) && !secrets.some((secret) => code.includes(secret)) ? code : ''
  // Never print SDK message, stack, request headers or credentials; only a safe code and fixed guidance.
  return `导出失败，阶段：${stage}${safeCode ? `；错误码：${safeCode}` : ''}。\n${advice}`
}

function argumentsFrom(values) {
  const options = {}
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index]
    if (['--include-test', '--preview', '--help'].includes(key)) options[key] = true
    else if (['--config', '--output', '--cutoff', '--input'].includes(key) && values[index + 1] && !values[index + 1].startsWith('--')) {
      options[key] = values[++index]
    } else throw new ExportInputError('参数无效，请使用 --help 查看用法。')
  }
  return options
}

async function main(values = process.argv.slice(2)) {
  const options = argumentsFrom(values)
  if (options['--help']) {
    console.log('npm run export:finishers -- --config production.local.json --output exports/finishers.xlsx [--cutoff ISO时间] [--preview]\n测试名单须使用测试配置并添加 --include-test。凭据通过 TENCENTCLOUD_SECRETID/SECRETKEY 或服务端 CLOUDBASE_APIKEY 环境变量提供。')
    console.log('本地转换无需凭据或云访问：bash tools/export-finishers/export-test.sh 控制台导出的JSON文件 [输出.xlsx]\n或 node tools/export-finishers/index.js --input 文件.json --config 活动配置.json --output 名单.xlsx [--include-test] [--preview]')
    return
  }
  if (!options['--config'] || !options['--output']) throw new ExportInputError('需要 --config 和 --output。')
  const config = await atStage('读取活动配置', async () => JSON.parse(await fs.readFile(path.resolve(options['--config']), 'utf8')))
  if (!checkConfig(config).ok) throw new ExportInputError('活动配置无效，正式配置必须包含开发账号排除名单。')
  if (config.mode !== 'production' && !options['--include-test']) throw new ExportInputError('默认不导出测试数据；测试配置必须添加 --include-test。')
  if (config.mode === 'production' && options['--include-test']) throw new ExportInputError('正式导出不允许 --include-test。')
  if (!options['--preview'] && Date.now() < config.reportingClosesAt + 60000) {
    throw new ExportInputError('补交窗口尚未结束；如需阶段性名单请添加 --preview，最终名单需在关闭后等待至少一分钟。')
  }
  const cutoff = options['--cutoff'] ? Date.parse(options['--cutoff']) : Date.now()
  if (!Number.isSafeInteger(cutoff) || cutoff <= 0 || cutoff > Date.now()) throw new ExportInputError('接收截止时间无效或在未来。')
  const output = path.resolve(options['--output'])
  if (path.extname(output).toLowerCase() !== '.xlsx') throw new ExportInputError('输出文件必须为 .xlsx。')
  await atStage('检查输出文件', async () => {
    try { await fs.lstat(output) } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    const error = new Error('OUTPUT_EXISTS')
    error.code = 'EEXIST'
    throw error
  })
  let result
  if (options['--input']) {
    result = await atStage('读取本地导出文件', async () => collectLocalRows(
      await readRecords(path.resolve(options['--input'])), config, cutoff))
  } else {
    const credentials = credentialsFrom()
    const cloudbase = require('@cloudbase/node-sdk')
    const db = await atStage('初始化云端连接', () => cloudbase.init({ env: config.environmentId, ...credentials }).database())
    result = await atStage('读取云数据库', () => collectRows(async ({ activityId, cursor, cutoff: until, limit }) => {
      const filter = { activityId, receivedAt: db.command.lte(until) }
      if (cursor) filter._id = db.command.gt(cursor)
      const response = await db.collection('finishers')
        .where(filter).orderBy('_id', 'asc').limit(limit).get()
      return response.data
    }, config, cutoff))
  }
  const buffer = await atStage('生成 Excel', () => createWorkbook(result, config, cutoff, {
    preview: options['--preview'], local: Boolean(options['--input'])
  }).xlsx.writeBuffer())
  // Exclusive creation preserves existing exports and prevents reporting a partial network result.
  await atStage('保存 Excel', async () => {
    await fs.mkdir(path.dirname(output), { recursive: true })
    await fs.writeFile(output, buffer, { flag: 'wx', mode: 0o600 })
  })
  console.log(`已导出 ${result.rows.length} 人；排除异常或重复记录 ${result.excluded} 条。\n${output}`)
  if (options['--input']) console.log('数据来自本地控制台导出文件，未访问云端；文件之外及后续新增记录不包含在本次名单内。')
}

if (require.main === module) main().catch((error) => {
  console.error(describeError(error))
  process.exitCode = 1
})

module.exports = { main, argumentsFrom, credentialsFrom, describeError, ExportOperationError }
