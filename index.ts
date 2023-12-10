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

const LIMIT = +(process.env.LIMIT || 99);

function processArguments() {
  if (proc.argv.length > 2) {
    log.info(`change dir to "${proc.argv[2]}"`);
    const cwd = proc.argv[2];
    const cmd = [
      process.env.YTDLP || 'yt-dlp',
      '--config-locations',
      `${cwd}/.yt-dlp.conf`,
    ];
    return { cmd, cwd };
  }
  log.error('need folder path as an argument');
  return null;
}

type RunResult = {
  success: boolean;
  msg: string;
};

/** run external command */
function run(cmds: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const ret = Bun.spawnSync(cmds, { cwd, env: process.env });
    const result = {
      success: ret.success,
      msg: ret.stdout.toString() + ret.stderr.toString(),
    };
    if (ret.success) {
      log.info(`running ${cmds} success ${result.msg}`);
      resolve(result);
    } else {
      log.error(`running ${cmds} failed ${result.msg}`);
      reject(result.msg);
    }
  });
}

/** sanitize filename */
function getSafeBasename(basename: string) {
  const str = basename.replace(/%/g, '％');
  return sanitize(
    Buffer.byteLength(str, 'utf8') > 200 ? str.substring(0, 50) : str
  );
}

function execDl({ cmd, cwd }: { cmd: string[]; cwd: string }) {
  return async ({ title, url }: { title: string; url: string }) => {
    log.info(`calling ytdl "${title}" (${url})`);
    const basename = getSafeBasename(title);
    if (DRY_RUN) {
      log.warn(`DRYRUN: basename:\n-> "${basename}"`);
      return true;
    }
    const dlcmd = [
      ...cmd,
      '--no-progress',
      '--output',
      `${basename}.%(ext)s`,
      '--',
      url,
    ];
    const { success, msg } = await run(dlcmd, cwd);
    log.info(`download result ${url}: ${success} - ${msg}`);
    return success;
  };
}

function VideoDb() {
  return {
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
      action: (arg: { title: string; url: string }) => Promise<boolean>
    ) {
      const database = this.getDatabaseInstance();
      const snapshot = await get(child(ref(database), 'videos'));
      const obj: Record<
        string,
        { title: string; url: string; error?: string; watched?: boolean }
      > = snapshot.val();
      if (!obj) {
        log.info('empty list');
        return false;
      }
      const tasks = Object.entries(obj)
        .slice(0, LIMIT)
        .filter(([_, { url, error }]) => !!url && !error)
        .map(([videoId, video]) => ({
          video,
          videoRef: ref(database, `/videos/${videoId}`),
        }))
        .map(async ({ video: { title, url, watched }, videoRef }) => {
          try {
            if (watched === true) {
              log.info(`deleting pre-marked item: ${title}`);
              await remove(videoRef);
              return true;
            }
            await action({ title, url });
            if (DRY_RUN) return true;
            await set(child(videoRef, 'watched'), true);
            return true;
          } catch (e) {
            var msg = typeof e === 'string' ? e : JSON.stringify(e);
            await set(child(videoRef, `error`), `${msg}`);
            log.error(`videodl: download failed... ${title} (${msg})`);
            return false;
          }
        });
      return tasks.reduce(
        async (acc, x) => (await acc) && (await x),
        Promise.resolve(true)
      );
    },
  };
}

/** main procedure */
async function main() {
  log.info('starting application ...');
  const args = processArguments();
  if (!args) return 1;
  try {
    const db = VideoDb();
    const v = await db.forEach(execDl(args));
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
