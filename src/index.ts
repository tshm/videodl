import { echo, cd, exit, exec } from 'shelljs';
import * as proc from 'process';
import * as firebase from 'firebase';
import * as path from 'path';

function processArguments() {
  // change current dir
  if (proc.argv.length > 2) {
    echo(`change dir to "${proc.argv[2]}"`);
    cd(proc.argv[2]);
    return true;
  }
  echo(`need folder path`);
  return false;
}

/** run external command */
const run = (cmd: string) =>
  new Promise<number>((resolve, reject) => {
    const exitcode = exec(cmd).code;
    if (exitcode === 0) {
      echo(`running ${cmd} succeed`);
      resolve(exitcode);
    } else {
      echo(`running ${cmd} failed`);
      reject(exitcode);
    }
  });

const execDl = (url: string) => {
  echo('calling ytdl');
  return run(`youtube-dl --no-progress "${url}"`);
};

function getData() {
  const config = require(path.resolve(__dirname, 'account.json'));
  const app = firebase.initializeApp(config);
  return app.database();
}

async function download(database: firebase.database.Database) {
  const snapshot = await database.ref('videos').once('value');
  const obj = snapshot.val();
  if (!obj) {
    echo('empty list');
    return false;
  }
  const jobs = Object.keys(obj).map(async k => {
    const v = obj[k];
    if (v.watched) {
      echo(`deleting pre-marked item: ${v.title}`);
      await database.ref(`videos/${k}`).remove();
      return true;
    }
    echo(`downloading: ${v.title}`);
    try {
      const dlResult = await execDl(v.url);
      echo(`execDl success: ${dlResult}`);
      try {
        await database.ref(`videos/${k}/watched`).set(true);
        return true;
      } catch (e) {
        return false;
      }
    } catch (e) {
      console.error(`videodl: download failed... ${v.title} (${e})`);
      throw e;
    }
  });
  return Promise.all(jobs);
}

/**   main procedure
 */
async function main() {
  echo('starting application ...');
  if (!processArguments()) exit(1);
  const database = getData();
  try {
    const v = await download(database);
    echo(`exiting: ${v}`);
    exit(0);
  } catch (e) {
    console.error(`some failed: ${e}`);
    exit(1);
  }
}

main();
