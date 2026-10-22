import assert from 'node:assert';
import { computeCriticalPath, deriveDuration, topologicalSort } from '../src/services/cpmService.js';

console.log('🧪 Starting Critical Path Analysis (CPM) Tests...\n');

// Test 1: Simple linear dependency chain (A -> B -> C)
{
  const tasks = [
    { _id: 'A', title: 'Task A', durationDays: 3 },
    { _id: 'B', title: 'Task B', durationDays: 4 },
    { _id: 'C', title: 'Task C', durationDays: 2 },
  ];
  const deps = [
    { predecessor: 'A', successor: 'B' },
    { predecessor: 'B', successor: 'C' },
  ];
  const res = computeCriticalPath(tasks, deps);
  assert.strictEqual(res.status, 'ok');
  assert.strictEqual(res.totalDuration, 9);
  assert.strictEqual(res.criticalTaskIds.length, 3);
  console.log('✅ Test 1: Linear dependency chain passed (Total 9 days)');
}

// Test 2: Two parallel paths with different durations
// Start -> A (5d) -> End
// Start -> B (2d) -> End
{
  const tasks = [
    { _id: 'S', title: 'Start', durationDays: 1 },
    { _id: 'A', title: 'Branch A', durationDays: 5 },
    { _id: 'B', title: 'Branch B', durationDays: 2 },
    { _id: 'E', title: 'End', durationDays: 1 },
  ];
  const deps = [
    { predecessor: 'S', successor: 'A' },
    { predecessor: 'S', successor: 'B' },
    { predecessor: 'A', successor: 'E' },
    { predecessor: 'B', successor: 'E' },
  ];
  const res = computeCriticalPath(tasks, deps);
  assert.strictEqual(res.status, 'ok');
  assert.strictEqual(res.totalDuration, 7); // S(1) + A(5) + E(1) = 7
  assert.deepStrictEqual(res.criticalTaskIds.sort(), ['A', 'E', 'S']);
  const bTask = res.results.find((r) => r.taskId === 'B');
  assert.strictEqual(bTask.slack, 3); // Branch B has 3 days float
  console.log('✅ Test 2: Parallel paths passed (Branch B has 3 days slack)');
}

// Test 3: Circular dependency detection
{
  const tasks = [
    { _id: 'A', title: 'Task A', durationDays: 2 },
    { _id: 'B', title: 'Task B', durationDays: 2 },
  ];
  const deps = [
    { predecessor: 'A', successor: 'B' },
    { predecessor: 'B', successor: 'A' },
  ];
  const res = computeCriticalPath(tasks, deps);
  assert.strictEqual(res.status, 'cycle_detected');
  console.log('✅ Test 3: Cycle detection passed (Circular dependency rejected)');
}

// Test 4: Single task with no dependencies
{
  const tasks = [{ _id: 'A', title: 'Standalone', durationDays: 4 }];
  const deps = [];
  const res = computeCriticalPath(tasks, deps);
  assert.strictEqual(res.status, 'ok');
  assert.strictEqual(res.totalDuration, 4);
  assert.strictEqual(res.results[0].slack, 0);
  console.log('✅ Test 4: Single standalone task passed');
}

// Test 5: Missing task duration warning
{
  const tasks = [
    { _id: 'A', title: 'Task With No Dates Or Duration' },
    { _id: 'B', title: 'Task B', durationDays: 3 },
  ];
  const deps = [];
  const res = computeCriticalPath(tasks, deps);
  assert.strictEqual(res.status, 'ok');
  assert.strictEqual(res.warnings.length, 1);
  assert.strictEqual(res.excludedTaskCount, 1);
  console.log('✅ Test 5: Missing duration warning & safe exclusion passed');
}

console.log('\n🎉 All 5 CPM Algorithm Tests Passed Successfully!');
