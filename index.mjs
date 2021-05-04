//@ts-check
import dotenv from 'dotenv';
import sh from 'shelljs';
import pino from 'pino';
import firebase from 'firebase';
import proc from 'process';
import sanitize from 'sanitize-filename';
import path from 'path';

const { cd, exec, exit } = sh;
dotenv.config({ path: `${path.resolve()}/../.env` });

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

/** run external command */
const run = (/** @type {string} */ cmd) =>
  new Promise((resolve, reject) => {
    const ret = exec(cmd);
    const result = { code: ret.code, msg: ret.stdout + ret.stderr };
    if (ret.code === 0) {
      log.info(`running ${cmd} succeed: ${result.msg}`);
      resolve(result);
    } else {
      log.error(`running ${cmd} failed: ${result.msg}`);
      reject(result);
    }
  });

/** sanitize filename */
const getSafeBasename = (/** @type {string} */ basename) => {
  const str = basename.replace(/%/g, '％');
  return sanitize(
    Buffer.byteLength(str, 'utf8') > 200 ? str.substring(0, 50) : str
  );
};

const execDl = async (
  /** @type {string} */ title,
  /** @type {string} */ url
) => {
  log.info('calling ytdl', url);
  const cmd = 'youtube-dl';
  const basename = getSafeBasename(title);
  if (DRY_RUN) {
    log.warn(`DRYRUN: basename:\n-> ${basename}`);
    return true;
  }
  const dlcmd = `${cmd} --no-progress --output "${basename}.%(ext)s" -- "${url}"`;
  const { code, msg } = await run(dlcmd);
  log.info(`download result ${url}: ${code} - ${msg}`);
  return code == 0;
};

function getData() {
  const config = {
    apiKey: process.env.apiKey,
    authDomain: process.env.authDomain,
    databaseURL: process.env.databaseURL,
    storageBucket: process.env.storageBucket,
  };
  if (DRY_RUN) log.debug(config);
  const app = firebase.initializeApp(config);
  return app.database();
}

/**
 * @param {firebase.database.Database} database
 */
async function download(database) {
  const snapshot = await database.ref('videos').once('value');
  const obj = snapshot.val();
  if (!obj) {
    log.info('empty list');
    return false;
  }
  const tasks = Object.entries(obj).map(async ([k, v]) => {
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
      log.debug({ dlResult });
      if (DRY_RUN) return true;
      await database.ref(`videos/${k}/watched`).set(true);
      return true;
    } catch (e) {
      await database.ref(`videos/${k}/error`).set(`${e.msg}`);
      log.error(`videodl: download failed... ${v.title} (${e.msg})`);
      return false;
    }
  });
  return tasks.reduce(
    async (acc, x) => (await acc) && (await x),
    Promise.resolve(true)
  );
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
