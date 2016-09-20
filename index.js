'use strict'
require('shelljs/global')

function processArguments() {
	const proc = require('process')
	// change current dir
	if (proc.argv.length > 2) {
		console.log(`change dir to "${ proc.argv[2] }"`)
		cd(proc.argv[2])
		return true
	}
	return false
}

function getDownloader() {
	const m2t = require('magnet-to-torrent')
	const r = /^magnet:/
	return function execDl(url) {
		// echo(`URL: ${ url }`)
		if (url.match(r)) {
			echo('downloading magnet')
			return m2t.getLink(url)
				.then( link => {
					console.log(`tlink: ${ link }`)
					return exec(`wget -p ../ ${ link }`).code == 0
				})
				.fail( e => {
					console.error(`retrieval failed: ${ e }`)
					return false
				})
		}
		return exec(`youtube-dl "${ url }"`)
	}
}

function abort(err) {
	console.error('videodl: error!!: ', err)
	exit(1)
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
	return database.ref('videos').once('value')
	.then(ss => {
		const obj = ss.val()
		if (!obj) {
			console.log('empty list')
			return false
		}
		return Promise.all(Object.keys(obj).map(k => {
			const v = obj[k]
			if (v.watched) {
				console.log('deleting pre-marked item: ', v.title)
				return database.ref(`videos/${k}`).remove()
			}
			console.log('downloading: ', v.title)
			return execDl(v.url).then(e =>
				e ? database.ref(`videos/${k}/watched`).set(true) : false
			).fail(e => {
				echo('retry next visit.', e)
				return false
			}).catch(e => {
				console.error(`videodl: download failed... ${v.title} (${e})`)
				return false
			})
		}))
	})
}

/**   main procedure
 */
function main() {
	console.log('starting application ...')
	if (processArguments()) {
		const database = getData()
		download(database).then(v => {
			echo('exiting')
			exit(0)
		})
	}
}

main()

