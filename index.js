/* global cd, exec, exit */
require('shelljs/global')
const log = require('log4js').getLogger()
const DRY_RUN = process.env.DRY_RUN || false
log.level = DRY_RUN ? 'debug' : 'info'
if (DRY_RUN) log.debug('run as DRY_RUN')

function processArguments () {
  const proc = require('process')
  // change current dir
  if (proc.argv.length > 2) {
    log.info(`change dir to "${proc.argv[2]}"`)
    cd(proc.argv[2])
    return true
  }
  log.info(`need folder path`)
  return false
}

function run (cmd) {
  return new Promise((resolve, reject) => {
    const exitcode = exec(cmd).code
    if (exitcode === 0) {
      log.info(`running ${cmd} succeed`)
      resolve(exitcode)
    } else {
      log.info(`running ${cmd} failed`)
      reject(exitcode)
    }
  })
}

function getDownloader () {
  return function execDl (url) {
    log.info('calling ytdl')
    if (DRY_RUN) return run(`echo youtube-dl --no-progress "${url}"`)
    return run(`youtube-dl --no-progress "${url}"`)
  }
}

function getData () {
  const firebase = require('firebase')
  const config = require(require('path').resolve(__dirname, 'account.json'))
  const app = firebase.initializeApp(config)
  return app.database()
}

function download (database) {
  const execDl = getDownloader()
  return database.ref('videos').once('value')
    .then(ss => {
      const obj = ss.val()
      if (!obj) {
        log.info('empty list')
        return false
      }
      return Promise.all(Object.keys(obj).map(k => {
        const v = obj[ k ]
        if (v.watched) {
          log.info(`deleting pre-marked item: ${v.title}`)
          return database.ref(`videos/${k}`).remove()
        }
        log.info(`downloading: ${v.title}`)
        return execDl(v.url).then(v => {
          log.info(`execDl success: ${v}`)
          return database.ref(`videos/${k}/watched`).set(true)
        }).catch(e => {
          log.error(`videodl: download failed... ${v.title} (${e})`)
          throw e
        })
      }))
    })
}

/**   main procedure
 */
function main () {
  log.info('starting application ...')
  if (processArguments()) {
    const database = getData()
    download(database).then(v => {
      log.info(`exiting: ${v}`)
      exit(0)
    }).catch(e => {
      log.error(`some failed: ${e}`)
      exit(1)
    })
  }
}

main()
