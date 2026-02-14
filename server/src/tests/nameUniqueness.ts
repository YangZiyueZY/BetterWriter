import assert from 'assert';
import { computeUniqueName } from '../services/nameUniqueness';

export const run = async () => {
  assert.equal(computeUniqueName('测试.md', []), '测试.md');
  assert.equal(computeUniqueName('测试.md', ['测试.md']), '测试 (1).md');
  assert.equal(computeUniqueName('测试.md', ['测试.md', '测试 (1).md']), '测试 (2).md');
  assert.equal(computeUniqueName('Report.txt', ['report.txt']), 'Report (1).txt');
  assert.equal(computeUniqueName('a', ['a', 'a (1)']), 'a (2)');
  assert.ok(!/~[0-9a-f]{6}/i.test(computeUniqueName('测试.md', ['测试.md'])));
  console.log('name uniqueness tests passed');
};

void run();

