'use strict'
require('shelljs/global')

function processArguments() {
	const proc = require('process')
	// change current dir
	if ( proc.argv.length > 2 ) {
		echo(`change dir to "${ proc.argv[2] }"`)
		cd( proc.argv[ 2 ])
		return true
	}
	return false
}

function run( cmd ) {
	return new Promise(( resolve, reject ) => {
		const exitcode = exec( cmd ).code
		if ( exitcode == 0 ) {
			echo(`running ${ cmd } succeed`)
			resolve( exitcode )
		} else {
			echo(`running ${ cmd } failed`)
			reject( exitcode )
		}
	})
}

function getDownloader() {
	const m2t = require('magnet-to-torrent')
	const magnet = /^magnet:/
	return function execDl( url ) {
		if ( url.match( magnet )) {
			echo('downloading magnet')
			return m2t.getLink( url )
				.then( link => {
					echo(`tlink: ${ link }`)
					return run(`wget -P ../ ${ link }`)
				})
				.catch( e => {
					console.error(`magnet retrieval failed: ${ e }`)
					throw e
				})
		}
		echo('calling ytdl')
		return run(`youtube-dl --no-progress "${ url }"`)
	}
}

function getData() {
	const firebase = require('firebase')
	const app = firebase.initializeApp({
		databaseURL: 'https://favideo-21e5b.firebaseio.com',
		serviceAccount: require('path').resolve( __dirname, 'account.json')
	})
	return app.database()
}

function download( database ) {
	const execDl = getDownloader()
	return database.ref('videos').once('value')
	.then( ss => {
		const obj = ss.val()
		if ( !obj ) {
			echo('empty list')
			return false
		}
		return Promise.all( Object.keys( obj ).map( k => {
			const v = obj[ k ]
			if ( v.watched ) {
				echo(`deleting pre-marked item: ${ v.title }`)
				return database.ref(`videos/${k}`).remove()
			}
			echo(`downloading: ${ v.title }`)
			return execDl( v.url ).then( v => {
				echo(`execDl success: ${ v }`)
				return database.ref(`videos/${k}/watched`).set( true )
			}).catch( e => {
				console.error(`videodl: download failed... ${ v.title } (${ e })`)
				throw e
			})
		}))
	})
}

/**   main procedure
 */
function main() {
	echo('starting application ...')
	if ( processArguments()) {
		const database = getData()
		download( database ).then( v => {
			echo(`exiting: ${ v }`)
			exit( 0 )
		}).catch( e => {
			console.error(`some failed: ${ e }`)
			exit( 1 )
		})
	}
}

main()

