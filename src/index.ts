import { cd, exit, exec } from 'shelljs';
import * as pino from 'pino';
import * as firebase from 'firebase';
import * as proc from 'process';
import * as path from 'path';
import sanitize = require('sanitize-filename');

const log = pino();
const DRY_RUN = process.env.DRY_RUN || false;
log.level = DRY_RUN ? 'debug' : 'info';
if (DRY_RUN) log.debug('run as DRY_RUN');

function processArguments() {
  if (proc.argv.length > 2) {
    log.info(`change dir to "${proc.argv[2]}"`);
    cd(proc.argv[2]);
    return true;
  }
  log.error('need folder path');
  return false;
}

/** run external command */
const run = (cmd: string) =>
  new Promise<[number, string]>((resolve, reject) => {
    const ret = exec(cmd);
    if (ret.code === 0) {
      log.info(`running ${cmd} succeed`);
      resolve([ret.code, ret.stdout]);
    } else {
      log.error(`running ${cmd} failed`);
      reject([ret.code, ret.stdout]);
    }
  });

/** sanitize filename */
const getSafeFilename = (filename: string) =>
  sanitize(
    Buffer.byteLength(filename, 'utf8') > 200
      ? path.basename(filename).substring(0, 50) + path.extname(filename)
      : filename
  );

const execDl = async (url: string) => {
  log.info('calling ytdl');
  const cmd = 'youtube-dl';
  const [code, streamname] = await run(`${cmd} --get-filename "${url}"`);
  if (code !== 0) return code;
  const filename = getSafeFilename(streamname);
  if (DRY_RUN) {
    log.warn('filename: ', filename);
    if (url.match('Su')) {
      throw new Error('test'); //return run(`echo ${cmdstr}`);
    }
    return true;
  }
  const dlcmd = `${cmd} --no-progress --output "${filename}" -- "${url}"`;
  const [exitcode, _msg] = await run(dlcmd);
  return exitcode;
};

function getData() {
  const config = require(path.resolve(__dirname, '../account.json'));
  const app = firebase.initializeApp(config);
  return app.database();
}

async function download(database: firebase.database.Database) {
  const snapshot = await database.ref('videos').once('value');
  const obj = snapshot.val();
  if (!obj) {
    log.info('empty list');
    return false;
  }
  const jobs = Object.keys(obj).map((k) => async () => {
    const v = obj[k];
    if (v.watched) {
      log.info(`deleting pre-marked item: ${v.title}`);
      await database.ref(`videos/${k}`).remove();
      return true;
    }
    log.info(`downloading: ${v.title}`);
    try {
      const dlResult = await execDl(v.url);
      log.info(`execDl success: ${dlResult}`);
      try {
        if (DRY_RUN) return true;
        await database.ref(`videos/${k}/watched`).set(true);
        return true;
      } catch (e) {
        return false;
      }
    } catch (e) {
      log.error(`videodl: download failed... ${v.title} (${e})`);
      return false;
    }
  });
  let result = true;
  for (const job of jobs) {
    result = result && (await job());
  }
  return result;
}

/**   main procedure
 */
async function main() {
  log.info('starting application ...');
  if (!processArguments()) exit(1);
  const database = getData();
  try {
    const v = await download(database);
    log.info(`exiting: ${v}`);
    exit(0);
  } catch (e) {
    log.error(`some failed: ${e}`);
    exit(1);
  }
}

main();
log.info('ending....');
