'use strict'

function processArguments() {
	const proc = require('process')
	// change current dir
	if (proc.argv.length > 2) {
		console.log(`change dir to "${ proc.argv[2] }"`)
		proc.chdir(proc.argv[2])
	}
}

function getDownloader() {
	const exec = require('child_process').execSync
	return function execDl(url) {
		exec(`youtube-dl "${ url }"`)
	}
}

function abort(err) {
	console.error('videodl: error!!: ', err)
	process.exit()
}

function getData() {
	const firebase = require('firebase')
	const app = firebase.initializeApp({
		databaseURL: 'https://favideo-21e5b.firebaseio.com',
		serviceAccount: require('path').resolve(__dirname, 'account.json')
	})
	return app.database()
}

function download(database) {
	const execDl = getDownloader()
	database.ref('videos').once('value')
	.then(ss => {
		const obj = ss.val()
		if (!obj) {
			console.log('empty list')
			return false
		}
		return Object.keys(obj).map(k => {
			const v = obj[k]
			if (v.watched) {
				console.log('deleting pre-marked item: ', v.title)
				return database.ref(`videos/${k}`).remove()
			}
			try {
				console.log('downloading: ', v.title)
				execDl(v.url)
			} catch(e) {
				console.error(`videodl: download failed... ${v.title} (${e})`)
			}
			return database.ref(`videos/${k}/watched`).set(true)
		})
	})
	.then((e) => {
		console.log('process complete.  exiting.', e)
		process.exit()
	})
	.catch((e) => abort(`something failed ${e}`))
}

/**   main procedure
 */
function main() {
	console.log('starting application ...')
	processArguments()
	const database = getData()
	download(database)
}

main()

