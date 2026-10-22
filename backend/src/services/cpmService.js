/**
 * Critical Path Method (CPM) Service
 *
 * Implements a standard CPM algorithm using topological ordering,
 * forward pass (ES/EF), backward pass (LS/LF), and slack calculation.
 *
 * Duration convention:
 * - Uses calendar days (not working days).
 * - durationDays field is authoritative if set.
 * - Otherwise derived as: ceil((dueDate - startDate) / ms_per_day).
 * - Tasks with no computable duration generate a warning and are excluded from CPM.
 *
 * Topological sort: Kahn's algorithm (BFS-based).
 * Cycle detection: Built into Kahn's — if any node has unprocessed in-degree after sort, a cycle exists.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Derive duration in calendar days for a task.
 * @param {object} task - plain object with durationDays, startDate, dueDate
 * @returns {{ days: number|null, warning: string|null }}
 */
export function deriveDuration(task) {
  // Authoritative: explicit durationDays
  if (task.durationDays !== null && task.durationDays !== undefined) {
    if (task.durationDays < 0) {
      return { days: null, warning: `Task "${task.title}" has negative durationDays.` };
    }
    if (!isFinite(task.durationDays)) {
      return { days: null, warning: `Task "${task.title}" has non-finite durationDays.` };
    }
    return { days: task.durationDays, warning: null };
  }

  // Derived from dates
  if (task.startDate && task.dueDate) {
    const start = new Date(task.startDate).getTime();
    const due = new Date(task.dueDate).getTime();
    if (due < start) {
      return { days: null, warning: `Task "${task.title}" has dueDate before startDate.` };
    }
    const days = Math.ceil((due - start) / MS_PER_DAY);
    return { days, warning: null };
  }

  return { days: null, warning: null }; // no data — caller decides how to handle
}

/**
 * Detect if the dependency graph has a cycle using Kahn's algorithm.
 * @param {string[]} nodeIds
 * @param {Map<string, string[]>} adjacency - predecessor -> [successors]
 * @returns {{ hasCycle: boolean, topologicalOrder: string[] }}
 */
export function topologicalSort(nodeIds, adjacency) {
  // Build in-degree map
  const inDegree = new Map(nodeIds.map((id) => [id, 0]));

  for (const [, successors] of adjacency) {
    for (const succ of successors) {
      if (inDegree.has(succ)) {
        inDegree.set(succ, inDegree.get(succ) + 1);
      }
    }
  }

  const queue = [...nodeIds.filter((id) => inDegree.get(id) === 0)];
  const order = [];

  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    const successors = adjacency.get(node) || [];
    for (const succ of successors) {
      const deg = inDegree.get(succ) - 1;
      inDegree.set(succ, deg);
      if (deg === 0) queue.push(succ);
    }
  }

  return {
    hasCycle: order.length !== nodeIds.length,
    topologicalOrder: order,
  };
}

/**
 * Run CPM on the given tasks and dependencies.
 *
 * @param {Array} tasks - array of task plain objects {_id, title, durationDays, startDate, dueDate, status}
 * @param {Array} deps - array of {predecessor: id, successor: id}
 * @returns {{ results, projectFinish, totalDuration, criticalPaths, warnings, status }}
 */
export function computeCriticalPath(tasks, deps) {
  const warnings = [];
  const includedTasks = [];
  const excludedTaskIds = new Set();

  // 1. Derive durations — exclude tasks with invalid/missing data
  const durationMap = new Map();
  for (const task of tasks) {
    const id = task._id.toString();
    const { days, warning } = deriveDuration(task);
    if (warning) warnings.push(warning);
    if (days === null) {
      warnings.push(`Task "${task.title}" has no computable duration and will be excluded from CPM.`);
      excludedTaskIds.add(id);
    } else {
      durationMap.set(id, days);
      includedTasks.push(task);
    }
  }

  const nodeIds = includedTasks.map((t) => t._id.toString());

  // 2. Build adjacency (predecessor → successors) for included nodes only
  const adjacency = new Map(nodeIds.map((id) => [id, []]));
  const predecessorMap = new Map(nodeIds.map((id) => [id, []])); // successor → [predecessors]

  for (const dep of deps) {
    const pred = dep.predecessor.toString();
    const succ = dep.successor.toString();
    if (excludedTaskIds.has(pred) || excludedTaskIds.has(succ)) continue;
    if (!adjacency.has(pred) || !adjacency.has(succ)) continue;
    adjacency.get(pred).push(succ);
    predecessorMap.get(succ).push(pred);
  }

  // 3. Topological sort + cycle detection
  const { hasCycle, topologicalOrder } = topologicalSort(nodeIds, adjacency);
  if (hasCycle) {
    return {
      results: [],
      projectFinish: null,
      totalDuration: null,
      criticalPaths: [],
      warnings,
      status: 'cycle_detected',
      error: 'Circular dependency detected in the project task graph. CPM cannot be computed.',
    };
  }

  if (topologicalOrder.length === 0) {
    return {
      results: [],
      projectFinish: 0,
      totalDuration: 0,
      criticalPaths: [],
      warnings,
      status: 'no_tasks',
    };
  }

  // 4. Forward pass: ES, EF
  const ES = new Map(); // earliest start
  const EF = new Map(); // earliest finish

  for (const id of topologicalOrder) {
    const duration = durationMap.get(id);
    const preds = predecessorMap.get(id) || [];
    const es = preds.length === 0 ? 0 : Math.max(...preds.map((p) => EF.get(p) ?? 0));
    const ef = es + duration;
    ES.set(id, es);
    EF.set(id, ef);
  }

  // Project finish = max EF across all terminal tasks
  const projectFinish = Math.max(...[...EF.values()]);

  // 5. Backward pass: LF, LS
  const LF = new Map();
  const LS = new Map();

  for (const id of [...topologicalOrder].reverse()) {
    const duration = durationMap.get(id);
    const successors = adjacency.get(id) || [];
    const lf = successors.length === 0
      ? projectFinish
      : Math.min(...successors.map((s) => LS.get(s) ?? projectFinish));
    const ls = lf - duration;
    LF.set(id, lf);
    LS.set(id, ls);
  }

  // 6. Slack + critical flag (slack ≤ 0 within floating point tolerance)
  const SLACK_TOLERANCE = 1e-9;
  const results = [];

  for (const task of includedTasks) {
    const id = task._id.toString();
    const es = ES.get(id);
    const ef = EF.get(id);
    const ls = LS.get(id);
    const lf = LF.get(id);
    const slack = ls - es;
    const isCritical = slack <= SLACK_TOLERANCE;

    results.push({
      taskId: id,
      title: task.title,
      status: task.status,
      durationDays: durationMap.get(id),
      es, ef, ls, lf,
      slack: Math.max(0, slack), // clamp floating point negatives to 0
      isCritical,
    });
  }

  // 7. Identify critical path(s) by tracing critical tasks from terminal to source
  const criticalSet = new Set(results.filter((r) => r.isCritical).map((r) => r.taskId));

  // Find critical terminal tasks (critical tasks with no critical successors)
  const criticalTerminals = [...criticalSet].filter((id) => {
    const succs = adjacency.get(id) || [];
    return succs.filter((s) => criticalSet.has(s)).length === 0;
  });

  // Trace backwards from each terminal through critical predecessors
  const criticalPaths = [];

  const tracePath = (id, path) => {
    const preds = predecessorMap.get(id) || [];
    const critPreds = preds.filter((p) => criticalSet.has(p));
    if (critPreds.length === 0) {
      criticalPaths.push([id, ...path].reverse());
      return;
    }
    for (const pred of critPreds) {
      tracePath(pred, [id, ...path]);
    }
  };

  for (const terminalId of criticalTerminals) {
    tracePath(terminalId, []);
  }

  return {
    results,
    projectFinish,
    totalDuration: projectFinish,
    criticalPaths,
    criticalTaskIds: [...criticalSet],
    warnings,
    status: 'ok',
    excludedTaskCount: excludedTaskIds.size,
  };
}
