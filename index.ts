import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, child } from 'firebase/database';
import proc from 'process';
import sanitize from 'sanitize-filename';

const log = {
  level: 'debug',
  debug: (txt: string) => console.debug(txt),
  info: (txt: string) => console.info(txt),
  error: (txt: string) => console.error(txt),
  warn: (txt: string) => console.warn(txt),
};
const DRY_RUN = process.env.DRY_RUN || false;
log.level = DRY_RUN ? 'debug' : 'info';
if (DRY_RUN) log.debug('run as DRY_RUN');

const CMD = [process.env.YTDLP || 'yt-dlp', '--config-locations', `${__dirname}/.yt-dlp.conf`];
const LIMIT = +(process.env.LIMIT || 999);
let PWD = '';

function processArguments() {
  if (proc.argv.length > 2) {
    log.info(`change dir to "${proc.argv[2]}"`);
    PWD = proc.argv[2];
    return true;
  }
  log.error('need folder path as an argument');
  return false;
}

/** run external command */
const run = (cmds: string[]): Promise<{ code: number, msg: string }> =>
  new Promise((resolve, reject) => {
    const ret = Bun.spawnSync(cmds, { cwd: PWD, env: process.env });
    const result = { code: ret.success ? 0 : 1, msg: ret.stdout.toString() + ret.stderr.toString() };
    if (ret.success) {
      log.info(`running ${cmds} succeed: ${result.msg}`);
      resolve(result);
    } else {
      log.error(`running ${cmds} failed: ${result.msg}`);
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

const execDl = async (
   { title, url } : {title: string, url: string}
) => {
  log.info(`calling ytdl "${title}" (${url})`);
  const basename = getSafeBasename(title);
  if (DRY_RUN) {
    log.warn(`DRYRUN: basename:\n-> "${basename}"`);
    return true;
  }
  const dlcmd = [ ...CMD, '--no-progress', '--output', `${basename}.%(ext)s`, '--', url ];
  const { code, msg } = await run(dlcmd);
  log.info(`download result ${url}: ${code} - ${msg}`);
  return code === 0;
};

const VideoDb = () => ({
  getDatabaseInstance() {
    const config = {
      apiKey: process.env.apiKey,
      authDomain: process.env.authDomain,
      databaseURL: process.env.databaseURL,
      storageBucket: process.env.storageBucket,
    };
    if (DRY_RUN) log.debug(`config: ${JSON.stringify(config)}`);
    const app = initializeApp(config);
    return getDatabase(app);
  },

  async forEach(
    action :(arg : {title: string, url: string}) => Promise<boolean>
  ) {
    const database = this.getDatabaseInstance();
    const snapshot = await get(child(ref(database), 'videos'));
    const obj: Record<string, { title: string, url: string, error?: string, watched?: boolean }>
      = snapshot.val();
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
  if (!processArguments()) return 1;
  try {
    const db = VideoDb();
    const v = await db.forEach(execDl);
    log.info(`exiting: ${v}`);
    return 0;
  } catch (e) {
    log.error(`caught exception. exiting: ${e}`);
    return 1;
  }
}

const ret = await main();
log.info('ending....');
process.exit(ret);
