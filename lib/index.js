'use strict';
const chalk = require('chalk');
const Confirm = require('prompt-confirm');
const clipboardy = require('clipboardy');
const path = require('path');
const ora = require('ora');
const del = require('del');
const exec = require('execa').shell;
const {promisify} = require('util');
const fs = require('fs');
const readFileAsync = promisify(fs.readFile);
const renameAsync = promisify(fs.rename);

/**
 * Temporary folder name
 * @param {string} dirName folder name
 * @returns {string} `{dirName}/tmp1539443749061`
 */
const tmpFolderName = dirName => path.join(`${dirName}-tmp${Date.now()}`);

/**
 * Read file data
 * @param {string} path path to folder
 * @returns {object} file data
 */
const readBowerFile = async path => {
    try {
        const data = await readFileAsync(path, {encoding: 'utf8'});

        const { name, repository } = JSON.parse(data);

        return {
            name,
            repository
        };
    } catch (err) {
        throw err;
    }
}

/**
 * Clone bower component
 * @param {string} action shell command
 * @returns {boolean} directory is cloned
 */
const cloneRepository = async (url, folder, branch) => {
    try {
        const b = branch ? `-b ${branch} ` : '';
        await exec(`git clone ${url} ${b} ${folder}`);
        return true;
    } catch (err) {
        throw err;
    }
}

const cloneMultiple = async (action, paths) => {
    const directories = paths.map(p => cloneRepository(action));
    try {
        return await Promise.all(directories);
    } catch (err) {
        throw err;
    }
}

/**
 * Remove directory
 * @param {string} path directory to remove
 * @returns {object} removed paths
 */
const removeDir = async path => {
    try {
        await del(path);

        return true;
    } catch (err) {
        throw err;
    }
}

/**
 * Rename temporary folder
 * @param {string} first temporary folder
 * @param {string} second new folder name
 */
const renameDir = async (first, second) => {
    try {
        await renameAsync(`./${first}`, `./${second}`);
        return true;
    } catch (err) {
        throw err;
    }
}

/**
 * @description
 * A workaround for going into folder after cloning.
 * The reason for this is that in a POSIX system (Linux, OSX, etc),
 * a child process cannot modify the environment of a parent process.
 * This includes modifying the parent process's working directory
 * and environment variables.
 * @param {string} folder to copy
 */
const goToDir = async folder => {
    try {
        const p = path.resolve(process.cwd(), folder);
        await clipboardy.write(p);
        return true;
    } catch (err) {
        throw err;
    }
}

/**
 * Checkout platform components with bower
 * @param {object} options cli options
 * @returns {Promise}
 */
const bowerGit = async options => {
    options = options || {};

    const {
        branch,
        list,
        path: folderPath
    } = options;

    let answer = true;

    if (!folderPath) {
        throw 'ABORTING: No path provided!';
    }

    // find platform folder
    if (!fs.existsSync(folderPath)) {
        throw `ABORTING: Folder "${chalk.bold(folderPath)}" does not exist`;
    }

    // find bower json
    const bowerPath = path.join(folderPath, 'bower.json');

    // find folder name
    const dirName = path.dirname(folderPath);

    // tmp folder name
    const tmpFolder = tmpFolderName(folderPath);

    if (!fs.existsSync(bowerPath)) {
        throw `ABORTING: No bower.json found in ${folderPath}`;
    }

    const { name, repository } = await readBowerFile(bowerPath);

    const spinner = ora();

    if (fs.existsSync(path.join(folderPath,'.git'))) {
        spinner.stop();
        const prompt = new Confirm(`${name} is already checked out, want to continue?`);
        answer = await prompt.run();

        if (!answer) {
            spinner.fail('Canceled');
            process.exit();
        }
    }

    if (options.verbose) {
        console.log(`Found bower component: ${name}`);
    }

    if (!repository || !repository.url || !repository.type) {
        throw('ABORTING: No repository information found in bower.json');
    }

    if (repository.type !== 'git') {
        throw('ABORTING: Not a git repository');
    }

    const { url } = repository;

    if (options.verbose) {
        console.log(`Cloning from ${url} to temporary directory...`);
    }

    if (answer) {
        spinner.start('Cloning');

        await cloneRepository(url, tmpFolder, branch);

        await removeDir(folderPath);

        await renameDir(tmpFolder, folderPath);

        if (options.verbose) {
            console.log(chalk.green('Done!'));
        }

        spinner.text = chalk.green(`Bower component "${chalk.bold(name)}" has been replaced by its git repository`);

        spinner.succeed();

        if (options.goto) {
            await goToDir(folderPath);
        }
    }

}

module.exports = bowerGit;
module.exports.testMode = false;
