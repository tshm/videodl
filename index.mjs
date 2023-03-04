//@ts-check
import sh from 'shelljs';
import pino from 'pino';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, child } from 'firebase/database';
import proc from 'process';
import sanitize from 'sanitize-filename';

const { cd, exec, exit } = sh;

const log = pino();
const DRY_RUN = process.env.DRY_RUN || false;
log.level = DRY_RUN ? 'debug' : 'info';
if (DRY_RUN) log.debug('run as DRY_RUN');

const LIMIT = process.env.LIMIT || 999;

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
    const ret = exec(cmd, { silent: true });
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
  /** @type {{title: string, url: string}}*/ { title, url }
) => {
  log.info('calling ytdl', title, url);
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

const VideoDb = (/** @type {pino.Logger} */ log) => ({
  getDatabaseInstance() {
    const config = {
      apiKey: process.env.apiKey,
      authDomain: process.env.authDomain,
      databaseURL: process.env.databaseURL,
      storageBucket: process.env.storageBucket,
    };
    if (DRY_RUN) log.debug('config: %o', config);
    const app = initializeApp(config);
    return getDatabase(app);
  },

  async forEach(
    /** @type {(arg : {title: string, url: string}) => Promise<boolean>} */
    action
  ) {
    const database = this.getDatabaseInstance();
    const snapshot = await get(child(ref(database), 'videos'));
    /** @type {Object.<string, { title: string, url: string, error: string?, watched: boolean?}>}} */
    const obj = snapshot.val();
    if (!obj) {
      log.info('empty list');
      return false;
    }
    const tasks = Object.entries(obj)
      .filter(([_, { url, error }]) => !!url && !error)
      .map(([key, values]) => ({
        values,
        record: ref(database, `/videos/${key}`),
      }))
      .map(async ({ values: { title, url, watched }, record }, ix) => {
        if (ix > LIMIT) return true;
        try {
          if (watched === true) {
            log.info(`deleting pre-marked item: ${title}`);
            await remove(record);
            return true;
          }
          await action({ title, url });
          if (DRY_RUN) return true;
          await set(child(record, 'watched'), true);
          return true;
        } catch (e) {
          await set(child(record, `error`), `${e.msg}`);
          log.error(`videodl: download failed... ${title} (${e.msg})`);
          return false;
        }
      });
    return tasks.reduce(
      async (acc, x) => (await acc) && (await x),
      Promise.resolve(true)
    );
  },
});

/** main procedure */
async function main() {
  log.info('starting application ...');
  if (!processArguments()) exit(1);
  try {
    const db = VideoDb(log);
    const v = await db.forEach(execDl);
    log.info(`exiting: ${v}`);
    exit(0);
  } catch (e) {
    log.error(`caught exception. exiting: ${e}`);
    exit(1);
  }
}

main();
log.info('ending....');
