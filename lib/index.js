'use strict';
const chalk = require('chalk');
const clipboardy = require('clipboardy');
const path = require('path');
const Ora = require('ora');
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

/**
 * TODO: Fix
 * Clone multiple bower components
 * @param {array} paths components to clone
 * @param {string} action shell command
 */
const checkOutComponents = async (paths, branch) => {
    const directories = paths.map(async dir => {
        const spinner = new Ora({ text: `Cloning ${dir}` });

        // find platform folder
        if (!fs.existsSync(dir)) {
            throw `ABORTING: Folder "${chalk.bold(dir)}" does not exist`;
        }

        // find bower json
        const bowerPath = path.join(dir, 'bower.json');

        const { name, repository } = await readBowerFile(bowerPath);

        // tmp folder name
        const tmpFolder = tmpFolderName(dir);

        if (!fs.existsSync(bowerPath)) {
            throw `ABORTING: No bower.json found in ${dir}`;
        }

        if (!repository || !repository.url || !repository.type) {
            throw 'ABORTING: No repository information found in bower.json';
        }

        if (repository.type !== 'git') {
            throw 'ABORTING: Not a git repository';
        }

        const { url } = repository;

        spinner.start('Cloning');

        await cloneRepository(url, tmpFolder, branch);

        await removeDir(dir);

        await renameDir(tmpFolder, dir);

        spinner.text = `Bower component "${chalk.bold.green(name)}" has been replaced by its git repository`;

        spinner.succeed();

        return name;
    });

    try {
        return Promise.all(directories);
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
const copyDirPath = async folder => {
    try {
        const p = path.resolve(process.cwd(), folder);
        await clipboardy.write(p);
        return true;
    } catch (err) {
        throw err;
    }
}

/**
 * Check if directory is a repository
 * @param {string} dir folder path
 * @returns {boolean}
 */
const isRepository = dir => {
    const d = path.resolve(process.cwd(), dir);
    return fs.existsSync(path.join(d,'.git'));
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
        force,
        goto,
        path: folderPath
    } = options;

    if (!folderPath) {
        throw 'ABORTING: No path provided!';
    }

    const folders = Array.isArray(folderPath) ? folderPath : folderPath.split(/,?\s+/);
    const repos = folders.filter(f => isRepository(f));
    const notRepos = folders.filter(f => !isRepository(f));
    const filtered = !force ? notRepos : repos.concat(notRepos);

    if (!force && repos.length > 0) {
        console.log(chalk`{red.bold ${repos.join('\n')}}\nThese are already checked out. Use {bold -f, --force} to continue.\n`);
    }

    // Checkout component
    await checkOutComponents(filtered, branch);

    if (filtered.length && goto) {
        const [ firstDir ] = filtered;
        await copyDirPath(firstDir);
    }

}

module.exports = bowerGit;
