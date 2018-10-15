#!/usr/bin/env node
const bowerGit = require('../lib');
const chalk = require('chalk');
const isAsyncSupported = require('is-async-supported')
const program = require('commander');
const pkg = require('../package.json');
const updateNotifier = require('update-notifier');

if (!isAsyncSupported()) {
    require('async-to-gen/register');
}

(async () => {
    await updateNotifier({
        pkg
    }).notify({ defer: false });
})();

program
    .version(
        chalk`{bold.green Bower Git} version: {bold v${pkg.version}}\n`,
        '-v, --version'
    );


program
    .arguments('<path>')
    .option('-b, --branch [value]', 'checkout specific branch', 'master')
    .option('-f, --force [y/n]', 'force checkout component', false)
    .option('-g, --goto [y/n]', 'copy component path', false)
    .option('-v, --verbose [y/n]', 'verbose mode', false)
    .parse(process.argv);

const options = {
    path: program.args[0],
    branch: program.branch,
    force: program.force,
    goto: program.goto,
    verbose: process.verbose
};

if (!process.argv.slice(2).length) {
    program.help();
}

program.on('option:verbose', function () {
    process.env.VERBOSE = this.verbose;
});

(async () => {
    try {
        await bowerGit(options);
    } catch (err) {
        console.error(chalk.red(`${err}`));
        process.exit(1);
    }
})();
