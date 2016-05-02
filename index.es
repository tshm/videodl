'use strict'
console.log('starting application ...')
const GoogleSpreadsheet = require('google-spreadsheet')
const exec = require('child_process').execSync
const proc = require('process')

// change current dir
if (proc.argv.length > 2) {
	console.log(`change dir to "${proc.argv[2]}"`)
	proc.chdir(proc.argv[2])
}

// spreadsheet key is the long id in the sheets URL 
const spreadsheet_key = '19vcGixK9Kx6BOgq43go9-MP2mpU7CZLnRNdc9ph5oFE'
const my_sheet = new GoogleSpreadsheet(spreadsheet_key)
 
// With auth -- read + write 
// see below for authentication instructions 
const creds = require('./account.json')

function execDl(url) {
	exec(`youtube-dl "${url}"`)
}

function abort( err ) {
	console.log('videodl: error!!: ', err)
	process.exit()
}
 
my_sheet.useServiceAccountAuth(creds, (err) => {
	// getInfo returns info about the sheet and an array or "worksheet" objects 
	if (err) { abort(err) }
	my_sheet.getInfo((err, sheet_info) => {
		if (err) { abort(err) }
		console.log(`videodl: ${sheet_info.title} is loaded.`)
		// use worksheet object if you want to stop using the # in your calls 
 
		const sheet1 = sheet_info.worksheets[0]
		sheet1.getRows({query: 'seen != 1'}, (err, rows) => {
			if (err) { abort(err) }
			console.log(`videodl: number of videos: ${rows.length}`)
			//console.log(rows[0]);
			rows.forEach((row, i) => {
				//if (row.seen) return;
				console.log(`videodl: download[${i+1}/${rows.length}]: ${row.title}`)
				try {
					execDl( row.url )
				} catch(e) {
					console.log(`videodl: download failed... ${row.title}`)
				}
				row.seen = 1
				row.save((a) => {console.log(`videodl: row.save() => ${a}`)})
			})
		})
	})
 
})

