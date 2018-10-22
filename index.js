/* global cd, exec, exit */
require('shelljs/global')
require('scribe-js')()
const console = process.console
const DRY_RUN = process.env.DRY_RUN || false
if (DRY_RUN) console.warning('run as DRY_RUN')

function processArguments () {
  const proc = require('process')
  // change current dir
  if (proc.argv.length > 2) {
    console.info(`change dir to "${proc.argv[2]}"`)
    cd(proc.argv[2])
    return true
  }
  console.info(`need folder path`)
  return false
}

function run (cmd) {
  return new Promise((resolve, reject) => {
    const exitcode = exec(cmd).code
    if (exitcode === 0) {
      console.info(`running ${cmd} succeed`)
      resolve(exitcode)
    } else {
      console.info(`running ${cmd} failed`)
      reject(exitcode)
    }
  })
}

function getDownloader () {
  return function execDl (url) {
    console.info('calling ytdl')
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
        console.info('empty list')
        return false
      }
      return Promise.all(Object.keys(obj).map(k => {
        const v = obj[ k ]
        if (v.watched) {
          console.info(`deleting pre-marked item: ${v.title}`)
          return database.ref(`videos/${k}`).remove()
        }
        console.info(`downloading: ${v.title}`)
        return execDl(v.url).then(v => {
          console.info(`execDl success: ${v}`)
          return database.ref(`videos/${k}/watched`).set(true)
        }).catch(e => {
          console.error(`videodl: download failed... ${v.title} (${e})`)
          throw e
        })
      }))
    })
}

/**   main procedure
 */
function main () {
  console.info('starting application ...')
  if (processArguments()) {
    const database = getData()
    download(database).then(v => {
      console.info(`exiting: ${v}`)
      exit(0)
    }).catch(e => {
      console.error(`some failed: ${e}`)
      exit(1)
    })
  }
}

main()
