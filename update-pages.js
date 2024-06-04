/**
 *  simple updater for html pages using partial html files -- jakemiki
 *
 *  walks recursively through *.html files, except ones which filename starts with '_'
 *  uses partial html files from _partial directory to replace parts marked with 'data-partial' attribute
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const prettier = require('prettier');

const partialsPath = '_partials';

let prettierOptions = undefined;
const args = process.argv.slice(2);
const indexPath = args[0] ?? '.';

console.info(`jake's website updater running in ${indexPath}`);

const partials = getPartials(partialsPath);
updatePages(findHtmlFilesSync(indexPath));

function* findHtmlFilesSync(dir, partials = false) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        if (!partials && file.startsWith('_')) {
            continue;
        }

        const filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);

        if (stats.isDirectory()) {
            yield* findHtmlFilesSync(filepath);
        } else if (file.endsWith('.html')) {
            yield filepath;
        }
    }
}

function getPartials(dir) {
    return Object.fromEntries(
        Array.from(findHtmlFilesSync(partialsPath, true)).map((p) => [
            path.basename(p).replaceAll(/(^_)|(\.html)/g, ''),
            undefined,
        ]),
    );
}

function getPartial(name) {
    if (name in partials) {
        if (!partials[name]) {
            const partialPath = path.join(partialsPath, `_${name}.html`);
            const partial = fs.readFileSync(partialPath).toString();
            const partialNode = new JSDOM(partial).window.document.querySelector('[data-partial]');
            partials[name] = partialNode;
        }
        return partials[name];
    }
    throw new Error(`No partial named '${name}'.`);
}

async function getPrettierOptions() {
    if (!prettierOptions) prettierOptions = await prettier.resolveConfig(path.join(__dirname, '.prettierrc'));
    return prettierOptions;
}

async function updatePage(filepath) {
    console.info(`updating page ${filepath}...`);
    const file = fs.readFileSync(filepath).toString();
    const dom = new JSDOM(file);

    const toReplace = dom.window.document.querySelectorAll('[data-partial]');
    const title = dom.window.document.title;

    toReplace.forEach((el) => {
        const partialName = el.getAttribute('data-partial');
        console.info(`replacing partial '${partialName}'`);
        const partialNode = getPartial(partialName);
        el.replaceWith(partialNode);

        if (partialName === 'head') {
            dom.window.document.title = title;

            dom.window.document
                .querySelector('[property="og:title"]')
                ?.setAttribute('content', dom.window.document.querySelector('h1')?.textContent.trim());

            dom.window.document
                .querySelector('[property="og:url"]')
                ?.setAttribute(
                    'content',
                    `https://jakemiki.me/${filepath.replace('index.html', '').replaceAll('\\', '/')}`,
                );

            dom.window.document.querySelector('[property="og:description"]')?.setAttribute(
                'content',
                dom.window.document
                    .querySelector('p')
                    ?.textContent.trim()
                    .replaceAll(/[ \n]+/g, ' '),
            );
        }
    });

    const options = await getPrettierOptions();
    const updated = await prettier.format(dom.serialize(), { ...options, parser: 'html' });
    fs.writeFileSync(filepath, updated.replaceAll(/([\w\-])=""/g, '$1'));

    console.info(`updating page ${filepath} done.`);
}

function updatePages(generator) {
    const res = generator.next();

    if (res.done) {
        return;
    }

    updatePage(res.value)
        .catch((reason) => {
            console.error(`error when updating ${res.value}`, reason);
        })
        .finally(() => updatePages(generator));
}
