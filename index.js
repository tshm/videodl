/* global echo, cd, exec, exit */
require('shelljs/global')

function processArguments () {
  const proc = require('process')
  // change current dir
  if (proc.argv.length > 2) {
    echo(`change dir to "${proc.argv[2]}"`)
    cd(proc.argv[2])
    return true
  }
  echo(`need folder path`)
  return false
}

function run (cmd) {
  return new Promise((resolve, reject) => {
    const exitcode = exec(cmd).code
    if (exitcode === 0) {
      echo(`running ${cmd} succeed`)
      resolve(exitcode)
    } else {
      echo(`running ${cmd} failed`)
      reject(exitcode)
    }
  })
}

function getDownloader () {
  return function execDl (url) {
    echo('calling ytdl')
    return run(`youtube-dl --no-progress "${url}"`)
  }
}

function getData () {
  const firebase = require('firebase')
  const config = require(require('path').resolve(__dirname, 'account.json'))
  const app = firebase.initializeApp(config)
  return app.database()
}

async function download (database) {
  const execDl = getDownloader()
  try {
    const dataEntry = await database.ref('videos').once('value')
    const list = dataEntry.val()
    if (!list) {
      echo('empty list')
      return false
    }
    return await Promise.all(Object.keys(list).map(async k => {
      const video = list[k]
      if (video.watched) {
        echo(`deleting pre-marked item: ${video.title}`)
        return database.ref(`videos/${k}`).remove()
      }
      echo(`downloading: ${video.title}`)
      const r = await execDl(video.url)
      echo(`execDl success: ${r}`)
      return database.ref(`videos/${k}/watched`).set(true)
    }))
  } catch (e) {
    console.error(e)
  }
}

/**   main procedure
*/
function main () {
  echo('starting application ...')
  if (!processArguments()) exit(1)
  const database = getData()
  try {
    const v = download(database)
    echo(`exiting: ${v}`)
    exit(0)
  } catch (e) {
    console.error(`some failed: ${e}`)
    exit(1)
  }
}

main()
