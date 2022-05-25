#! /usr/bin/env ts-node

import path = require('path');
import mkdirp = require('mkdirp');
import ora = require('ora');
import fs = require('fs');

const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const { STAGE_OPERATORS, QUERY_OPERATORS, EXPRESSION_OPERATORS, CONVERSION_OPERATORS, ACCUMULATORS } = require('mongodb-ace-autocompleter');
const SNIPPETS_DIR = path.join(__dirname, '..', 'snippets');

/**
 * Transforms `mongodb-ace-autocompleter` snippets
 * into the vscode snippets.
 *
 * @param {String} prefix - The stage operator.
 * @param {String} description - The stage description.
 * @param {String} snippet - The stage snippet.
 * @param {String} comment - The optional comment.
 *
 * @returns {String} - The vscode snippet.
 */
const snippetTemplate = (
  prefix: string,
  description: string,
  snippet: string,
  comment?: string
): { prefix: string; body: Array<string>; description: string } => {
  const find = /[$]/;
  const re = new RegExp(find, 'g');
  let body = snippet.split('\n');

  // The `mongodb-ace-autocompleter` stores the stage prefix separately
  // from the stage body. In vscode extension we want to autopopulate
  // the body together with the prefix.
  // We also need to escape the `$` symbol in prefix.
  body[0] = `\\${prefix}: ${body[0]}`;

  // The stage comments are also stored separately
  // and might contain the `$` symbol
  // that is being interpreted by vscode as variable name,
  // but the variable is not known.
  // The solution is to escape this symbol before building the stage body.
  body = comment
    ? [...comment.trim().replace(re, '\\$').split('\n'), ...body]
    : [...body];

  return { prefix, body, description };
};

interface AceAutocompleterEntry {
  label: string;
  name: string;
  description: string;
  value: string;
  snippet?: string;
  comment?: string;
  meta: string
}
const docsUrl = (meta: string, name: string) => `https://www.mongodb.com/docs/manual/reference/operator/${meta === 'query' ? meta : 'aggregation'}/${name.slice(1)}/`
function convertSnippets(snippets: any, prefix: string) {
  return snippets.reduce((prev: any, curr: AceAutocompleterEntry) => {
    prev[`MongoDB ${prefix} ${curr.name}`] = snippetTemplate(
      curr.label || curr.name,
      (
        (curr.description || '')
        //  + `\n\n[Read More](${toUrl(curr.meta, curr.name)})`
      ).trim(),
      curr.snippet || '${1:value}',
      curr.comment || `/** @see ${docsUrl(curr.meta, curr.name)} */\n`
    )
    return prev
  }, {})
}
const snippets = {
  ...convertSnippets(STAGE_OPERATORS, 'Aggregations'),
  ...convertSnippets(QUERY_OPERATORS, 'Query'),
  ...convertSnippets(EXPRESSION_OPERATORS, 'Expression'),
  ...convertSnippets(CONVERSION_OPERATORS, 'Conversion'),
  ...convertSnippets(ACCUMULATORS, 'Accumulator'),
};

(async () => {
  const ui = ora('Update snippets').start();

  ui.info(`Create the ${SNIPPETS_DIR} folder`);
  await mkdirp(SNIPPETS_DIR);
  await writeFile(
    `${SNIPPETS_DIR}/stage-autocompleter.json`,
    JSON.stringify(snippets, null, 2)
  );
  ui.succeed(`Updated ${SNIPPETS_DIR}/stage-autocompleter.json`);
})();
