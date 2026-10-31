import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import * as contracts from '../src/contracts/index.js';
test('published JSON examples satisfy their named v1 schemas',()=>{const data=JSON.parse(readFileSync('examples/contracts.json','utf8'));assert.equal(data.synthetic,true);for(const [name,value]of Object.entries(data.schemas)){const schema=(contracts as any)[name];assert.ok(schema);schema.parse(value);}});
