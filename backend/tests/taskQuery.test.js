/**
 * Unit tests for the task query builders.
 * These run without a database: node --test tests/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTaskFilter,
  buildTaskSort,
  buildPagination,
  escapeRegex,
  toArray,
} from '../src/services/taskQuery.js';

const workspaceId = '65f000000000000000000001';
const userId = '65f000000000000000000002';

test('escapeRegex neutralises special characters', () => {
  assert.equal(escapeRegex('a.b*c'), 'a\\.b\\*c');
  assert.equal(escapeRegex('(test)'), '\\(test\\)');
});

test('toArray supports comma strings and repeated params', () => {
  assert.deepEqual(toArray('todo,done'), ['todo', 'done']);
  assert.deepEqual(toArray(['todo', 'done', 'todo']), ['todo', 'done']);
  assert.deepEqual(toArray(undefined), []);
  assert.deepEqual(toArray(''), []);
});

test('buildTaskFilter scopes every query to the workspace', () => {
  const filter = buildTaskFilter({ workspaceId, userId, query: {} });
  assert.equal(filter.workspace, workspaceId);
});

test('buildTaskFilter maps multi-status, priority and assignee filters', () => {
  const filter = buildTaskFilter({
    workspaceId,
    userId,
    query: { status: 'todo,in_progress', priority: ['high', 'urgent'], assignee: 'me' },
  });
  assert.deepEqual(filter.status, { $in: ['todo', 'in_progress'] });
  assert.deepEqual(filter.priority, { $in: ['high', 'urgent'] });
  assert.equal(filter.assignee, userId);
});

test('buildTaskFilter ignores unassigned flag when myTasks is set', () => {
  const filter = buildTaskFilter({ workspaceId, userId, query: { myTasks: 'true' } });
  assert.equal(filter.assignee, userId);
});

test('buildTaskFilter handles overdue and date windows', () => {
  const filter = buildTaskFilter({
    workspaceId,
    userId,
    query: { overdue: 'true', dueBefore: '2026-01-31', dueAfter: '2026-01-01' },
  });
  assert.deepEqual(filter.status, { $ne: 'done' });
  assert.ok(filter.dueDate.$lt instanceof Date);
  assert.ok(filter.dueDate.$gte instanceof Date);
  assert.ok(filter.dueDate.$lte instanceof Date);
});

test('buildTaskFilter escapes the search term', () => {
  const filter = buildTaskFilter({ workspaceId, userId, query: { search: 'a.*b' } });
  assert.equal(filter.$or.length, 3);
  const source = filter.$or[0].title.source;
  assert.ok(source.includes('a\\.\\*b'), source);
});

test('buildTaskSort only accepts whitelisted fields', () => {
  assert.deepEqual(buildTaskSort({ sort: 'dueDate', dir: 'asc' }), { dueDate: 1, createdAt: -1 });
  assert.deepEqual(buildTaskSort({ sort: 'createdAt', dir: 'asc' }), { createdAt: 1 });
  assert.deepEqual(buildTaskSort({ sort: 'priority' }), { priority: 1 });
  assert.deepEqual(buildTaskSort({ sort: 'evil; db.dropDatabase()' }), { position: 1, createdAt: -1 });
});

test('buildPagination clamps unsafe values', () => {
  assert.deepEqual(buildPagination({ page: '-5', limit: '9999' }, { defaultLimit: 25, maxLimit: 200 }), {
    page: 1,
    limit: 200,
    skip: 0,
  });
  assert.deepEqual(buildPagination({ page: '3', limit: '10' }), { page: 3, limit: 10, skip: 20 });
  assert.deepEqual(buildPagination({}), { page: 1, limit: 50, skip: 0 });
});
