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
  log.error('need folder path as an argument');
  return false;
}

type runResult = {
  code: number;
  msg: string;
};

/** run external command */
const run = (cmd: string) =>
  new Promise<runResult>((resolve, reject) => {
    const ret = exec(cmd);
    const result = { code: ret.code, msg: ret.stdout + ret.stderr };
    if (ret.code === 0) {
      log.info(`running ${cmd} succeed: ${result}`);
      resolve(result);
    } else {
      log.error(`running ${cmd} failed: ${result}`);
      reject(result);
    }
  });

/** sanitize filename */
const getSafeBasename = (basename: string) => {
  const str = basename.replace(/%/g, '％');
  return sanitize(
    Buffer.byteLength(str, 'utf8') > 200 ? str.substring(0, 50) : str
  );
};

const execDl = async (title: string, url: string) => {
  log.info('calling ytdl');
  const cmd = 'youtube-dl';
  const basename = getSafeBasename(title);
  if (DRY_RUN) {
    log.warn(`DRYRUN: basename:\n-> ${basename}`);
    return true;
  }
  const dlcmd = `${cmd} --no-progress --output "${basename}.%(ext)s" -- "${url}"`;
  const { code, msg } = await run(dlcmd);
  log.info(`download result: ${code} - ${msg}`);
  return code == 0;
};

function getData() {
  const config = require(path.resolve(__dirname, '../account.json'));
  const app = firebase.initializeApp(config);
  return app.database();
}

async function download(database: firebase.database.Database) {
  const snapshot = await database.ref('videos').once('value');
  const obj: Object = snapshot.val();
  if (!obj) {
    log.info('empty list');
    return false;
  }
  const promises = Object.entries(obj).map(async ([k, v]) => {
    if (v?.error) {
      log.warn('skip errored entries');
      return true;
    }
    if (v?.watched === true) {
      log.info(`deleting pre-marked item: ${v.title}`);
      await database.ref(`videos/${k}`).remove();
      return true;
    }
    log.info(`downloading: ${v.title}`);
    try {
      const dlResult = await execDl(v.title, v.url);
      log.info(`execDl success: ${dlResult}`);
      if (DRY_RUN) return true;
      await database.ref(`videos/${k}/watched`).set(true);
      return true;
    } catch (e) {
      await database.ref(`videos/${k}/error`).set(`${e.msg}`);
      log.error(`videodl: download failed... ${v.title} (${e.msg})`);
      return false;
    }
  });
  let result = true;
  for (const task of promises) {
    result = result && (await task);
  }
  return result;
}

/** main procedure */
async function main() {
  log.info('starting application ...');
  if (!processArguments()) exit(1);
  const database = getData();
  try {
    const v = await download(database);
    log.info(`exiting: ${v}`);
    exit(0);
  } catch (e) {
    log.error(`caught exception. exiting: ${e}`);
    exit(1);
  }
}

main();
log.info('ending....');
