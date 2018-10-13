
const chalk = require('chalk');
const path = require('path');
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
const tmpFolderName = dirName => path.join(dirName, `tmp${Date.now()}`);

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
const cloneRepository = async action => {
    try {
        const clone = await exec(action);
        console.log(clone);
        return true;
    } catch (err) {
        throw err;
    }
}

/**
 * Remove directory
 * @param {string} path directory to remove
 * @returns {object} removed paths
 */
const rmDir = async path => {
    try {
        const rm = await del(path);

        return rm;
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

    console.log(branch, list, folderPath);

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

    if (!fs.existsSync(bowerPath)) {
        throw `ABORTING: No bower.json found in ${folderPath}`;
    }

    fs.readFile(bowerPath, function(err, data) {
        'use strict';
        if (err) {
            throw err;
        }

        var json = JSON.parse(data);
        var url;
        var checkout = branch ? '-b ' + branch : '';
        var tmpFolderName = path.join(dirName, 'tmp' + Date.now());

        if (options.verbose) {
            console.log(indent + 'Found bower component: ' + json.name);
        }

        if (!json.repository || !json.repository.url || !json.repository.type) {
            throw('ABORTING: No repository information found in bower.json');
        }

        if (json.repository.type !== 'git') {
            throw('ABORTING: Not a git repository');
        }

        if (!module.exports.testMode) {
            console.log(indent + 'Replacing bower component with git repository...');
        }

        url = json.repository.url;

        if (options.verbose) {
            console.log(indent + 'Cloning from ' + url + ' to temporary directory...');
        }

        exec('git clone ' + url + ' ' + checkout + ' ' + tmpFolderName, function(err) {
            if (err) {
                throw err;
            }

            if (options.verbose) {
                console.log(chalk.green(indent + indent + 'Done!'));
                console.log(indent + 'Deleting bower component folder...');
            }

            // TODO: rename old folder before removing to be able to fallback
            // 1. rename old folder to tmp
            // 2. rename new folder to component name
            // 3. delete old folder

            promise = del(folderPath).then(function(paths) {
                // console.log('Deleted files/folders:\n', paths.join('\n'));

                if (options.verbose) {
                    console.log(chalk.green(indent + indent + 'Done!'));
                    console.log(indent + 'Cleaning up temporary directories...');
                }

                fs.rename('./' + tmpFolderName, './' + folderPath, function(err) {
                    if (err) {
                        throw err;
                    }
                    if (options.verbose) {
                        console.log(chalk.green(indent + indent + 'Done!'));
                    }
                    console.log(chalk.green(indent + 'Bower component "' + json.name + '" has been replaced by its git repository'));
                });

            }).catch(function() {
                // console.log('del throws');
                if (!module.exports.testMode) {
                    console.log(indent + 'Cleaning up temporary directories...');
                }

                del(tmpFolderName).then(function(paths) {
                    console.log(indent + indent + 'Done!');
                    console.log(chalk.red(indent + 'Aborted'));
                });
                throw('Could not delete bower component in ' + folderPath);
            });
        });

    });

    return promise;
}

module.exports = bowerGit;
module.exports.testMode = false;
