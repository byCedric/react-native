/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

'use strict';
import type {SchemaType} from '../../CodegenSchema.js';

const {FlowParser} = require('../../parsers/flow/parser');
const {TypeScriptParser} = require('../../parsers/typescript/parser');
const {filterJSFile} = require('./combine-utils');
const fs = require('fs');
const {globSync} = require('glob');
const path = require('path');

const flowParser = new FlowParser();
const typescriptParser = new TypeScriptParser();

function combineSchemas(files: Array<string>): SchemaType {
  return files.reduce(
    (merged, filename) => {
      const contents = fs.readFileSync(filename, 'utf8');

      if (
        contents &&
        (/export\s+default\s+\(?codegenNativeComponent</.test(contents) ||
          /extends TurboModule/.test(contents))
      ) {
        const isTypeScript =
          path.extname(filename) === '.ts' || path.extname(filename) === '.tsx';

        const parser = isTypeScript ? typescriptParser : flowParser;

        const schema = parser.parseFile(filename);

        if (schema && schema.modules) {
          merged.modules = {...merged.modules, ...schema.modules};
        }
      }
      return merged;
    },
    {modules: {}},
  );
}

function expandDirectoriesIntoFiles(
  fileList: Array<string>,
  platform: ?string,
  exclude: ?RegExp,
): Array<string> {
  return fileList
    .flatMap(file => {
      if (!fs.lstatSync(file).isDirectory()) {
        return [file];
      }
      return globSync('**/*.{js,ts,tsx}', {
        nodir: true,
        absolute: true,
        cwd: file,
      });
    })
    .filter(element => filterJSFile(element, platform, exclude));
}

function combineSchemasInFileList(
  fileList: Array<string>,
  platform: ?string,
  exclude: ?RegExp,
): SchemaType {
  const expandedFileList = expandDirectoriesIntoFiles(
    fileList,
    platform,
    exclude,
  );
  const combined = combineSchemas(expandedFileList);
  if (Object.keys(combined.modules).length === 0) {
    console.error(
      'No modules to process in combine-js-to-schema-cli. If this is unexpected, please check if you set up your NativeComponent correctly. See combine-js-to-schema.js for how codegen finds modules.',
    );
  }
  return combined;
}

function combineSchemasInFileListAndWriteToFile(
  fileList: Array<string>,
  platform: ?string,
  outfile: string,
  exclude: ?RegExp,
): void {
  const combined = combineSchemasInFileList(fileList, platform, exclude);
  const formattedSchema = JSON.stringify(combined);
  fs.writeFileSync(outfile, formattedSchema);
}

module.exports = {
  combineSchemas,
  combineSchemasInFileList,
  combineSchemasInFileListAndWriteToFile,
};
