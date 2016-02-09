console.log('starting application ...')
let GoogleSpreadsheet = require('google-spreadsheet')
let exec = require('child_process').execSync
let proc = require('process')

// change current dir
if (proc.argv.length > 2) {
	console.log(`change dir to "${proc.argv[2]}"`)
	proc.chdir(proc.argv[2])
}

// spreadsheet key is the long id in the sheets URL 
let spreadsheet_key = '19vcGixK9Kx6BOgq43go9-MP2mpU7CZLnRNdc9ph5oFE'
let my_sheet = new GoogleSpreadsheet(spreadsheet_key)
 
// With auth -- read + write 
// see below for authentication instructions 
let creds = require('./account.json')

let execDl = (url) => {
	exec(`youtube-dl --write-sub "${url}"`)
}
 
my_sheet.useServiceAccountAuth(creds, (err) => {
	// getInfo returns info about the sheet and an array or "worksheet" objects 
	if (err) { console.log( 'error: ' + err ) }
	my_sheet.getInfo((err, sheet_info) => {
		if (err) { console.log( 'error: ' + err ) }
		console.log( sheet_info.title + ' is loaded' )
		// use worksheet object if you want to stop using the # in your calls 
 
		let sheet1 = sheet_info.worksheets[0]
		sheet1.getRows({query: 'seen != 1'}, (err, rows) => {
			if (err) { console.log( 'error: ' + err ) }
			//console.log(rows[0]);
			rows.forEach((row) => {
				//if (row.seen) return;
				console.log('download: ' + row.title)
				execDl( row.url )
				row.seen = 1
				row.save()
			})
		})
	})
 
})

