{ pkgs, ... }:

{
  packages = [ pkgs.git ];

  enterShell = ''
    git status
  '';

  languages.javascript.enable = true;

  scripts.run.exec = ''
    node index.mjs . | pino-dev
  '';

  scripts.dryrun.exec = ''
    env DRY_RUN=true node index.mjs . | pino-dev
  '';

  pre-commit.hooks.shellcheck.enable = true;

  # processes.ping.exec = "ping example.com";
}
