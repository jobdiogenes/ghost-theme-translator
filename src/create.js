/*=====================================================
    Handles create command
=====================================================*/
const fs = require('fs');
const rra = require('recursive-readdir-async');
const chalk = require('chalk')
const {performance} = require('perf_hooks');
const validateDirectory = require('./lib/validate-directory');
const checkThemeName = require('./lib/check-theme-name');
const checkLanguage = require('./lib/check-language')
const collectStrings = require('./lib/collect-string');
const Spinner = require('./lib/spinner')
const spinner = new Spinner();

// add to support .ignore file
const path = require('path');
const ignore = require("ignore");

// Function to parse .gitignore file
function parseGTTignore(dirPath) {
    const gitignorePath = path.join(dirPath, ".gttignore");
    if (!fs.existsSync(gitignorePath)) {
        return ignore().add([]); // Return an empty ignore instance if no .gitignore exists
    }

    const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
    return ignore().add(gitignoreContent); // Add .gitignore rules
}

/*=====================================================
    create function
=====================================================*/
function create(options) {
    let timeStart = performance.now();    
    let { language, dir, themeName } = options;

    // If an option provided without any value (empty string)
    if ('' === language || '' === dir || '' == themeName) {
        console.log(chalk.red('Error: NO value specified.'));
        console.log(chalk.blue('You have given one or more options but no value.'));
        console.log(chalk.blue('You must give a valid value for each provided option.'));
        process.exit(1);
    }

    // If --theme-root option has no value
    // Then set themeRoot to current working directory
    if (dir === undefined) {
        dir = process.cwd();
    }

    // Check if directory is workable
    // Dir should be a Ghost theme's root or Ghost's installation root
    // "validateDirectory" function returns an object with "dir" and "type"
    // "dir" key will be a workable directory path, 
    // "type" will be either "theme-root" or "ghost-root"
    const dirObj = validateDirectory(dir);
    let themeRoot;
    if ('theme-root' === dirObj.dirType) {
        themeRoot = dirObj.dirPath;
    } else if ('ghost-root' === dirObj.dirType) {
        if (themeName !== undefined) {
            console.log(chalk.red('Error: your directory is a Ghost root directory, theme name required.'))
            console.log(chalk.blue('pass a theme folder name using --theme-name or -n option.'));
            process.exit(1);
        } else {
            themeRoot = checkThemeName(dirObj.dirPath, themeName);
        }
    }
    // check language option value is a valid language and get language code
    language = checkLanguage(language);
    // start the working message with spinner
    spinner.start('File is being created...')

    const localesDir = `${themeRoot}/locales`;
    // read directory recursively
    const rraOptions = {
        mode: rra.LIST,
        recursive: true,
        stats: false,
        ignoreFolders: true,
        extensions: true,
        deep: false,
        realPath: true,
        normalizePath: true,
        include: [],
        exclude: ['node_modules', '.git'],
        readContent: true,
        encoding: 'utf8'
    }
    rra.list(themeRoot, rraOptions)
        .then(files=> {
            let arr = [];
            const ignoreRules = parseGTTignore(themeRoot);
            files.forEach(file => {
                const relativePath = path.relative(themeRoot, file.fullname);
                let {extension, name, data} = file;
                if (extension === '.hbs' && !ignoreRules.ignores(relativePath)) {
                    console.log("Process:"+name);  // in case of error you could now where stopped. 
                    let strings = collectStrings(data)
                    arr = [...new Set([...arr ,...strings])];
                            
                    let json ={}
                    arr.map((val)=>{
                        json[val] = val 
                    })
                    // console.log(json);
                    fs.mkdir(localesDir, { recursive: true }, (err) => {
                        if (err) throw err;
                    });
                    // preparing json by stringify and replacing extra escape character
                    json = JSON.stringify(json, null, 4).replace(/\\\\"/g, '"').replace(/\\\\/g, '\\')
                    fs.writeFile(`${localesDir}/${language}.json`, json, 'utf8', (err)=> {
                        if (err) throw error;
                    });
                }
            });
            spinner.stop();
            let timeEnd = performance.now();
            const ms = `${Math.round(timeEnd - timeStart)} ms.`;
            console.log(chalk.green.bold('Success:'),chalk.cyan(`${language}.json`), chalk.green(`file has been created in`), chalk.cyan(ms));
        })
        .catch(err => console.log(err));
}

module.exports = create;
