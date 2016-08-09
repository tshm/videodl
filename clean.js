'use strict'

function abort(err) {
	console.error('videodl: error!!: ', err)
	process.exit()
}

function getData() {
	const firebase = require('firebase')
	const app = firebase.initializeApp({
		databaseURL: 'https://favideo-21e5b.firebaseio.com',
		serviceAccount: './account.json'
	})
	return app.database()
}

function clean() {
	const database = getData()
	database.ref('videos').once('value')
	.then(ss => {
		const obj = ss.val()
		return Promise.all(Object.keys(obj).map(k => {
			const v = obj[k]
			if (!v.watched) {
				console.log('skipping not watched: ', v.title)
				return false
			}
			console.log('deleting: ', v.title)
			return database.ref(`videos/${k}`).remove()
		}))
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
	clean()
}

main()

