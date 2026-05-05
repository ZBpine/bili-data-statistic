const compareNodeKey = (a, b) => {
  const an = Number(a);
  const bn = Number(b);
  const aNum = Number.isFinite(an);
  const bNum = Number.isFinite(bn);
  if (aNum && bNum) return an - bn;
  if (aNum) return -1;
  if (bNum) return 1;
  return String(a).localeCompare(String(b));
};

const pickRootKey = (keys, indegreeMap) => {
  if (!keys.length) return null;
  const zeroIn = keys.filter((key) => Number(indegreeMap.get(key) || 0) <= 0);
  const pool = zeroIn.length ? zeroIn : keys;
  return [...pool].sort(compareNodeKey)[0] || null;
};

const toIdList = (list) => {
  return (Array.isArray(list) ? list : [])
    .map((edge) => edge?.id)
    .filter((id) => id != null)
    .map((id) => String(id));
};

const EPSILON = 1e-6;

export const layoutFlowGraph = (graphMap, options = {}) => {
  const {
    rootId,
    direction = 'LR',
    mode = 'compact',
    spread = false,
    layoutRatio = 2,
    baseGap = 100,
    baseSpan = 4,
    maxArea = 100_000_000,
    removeBackEdges = false,
    passes,
    getNodeLabel,
    getNodeValue,
    getEdgeValue,
  } = options;

  const ratioInput = Number(layoutRatio);
  const baseInput = Number(baseGap);
  const ratio = Number.isFinite(ratioInput) ? ratioInput : 2;
  const base = Number.isFinite(baseInput) ? baseInput : 100;

  const map = graphMap && typeof graphMap === 'object' ? graphMap : {};
  const keys = Object.keys(map).sort(compareNodeKey);
  if (!keys.length) return {
    data: [],
    links: [],
    meta: {
      levelMap: new Map(),
      scale: 1,
      viewport: { width: 0, height: 0, area: 0 },
    },
  };

  const indegreeMap = new Map();
  const adjacency = new Map();
  const reverseAdjacency = new Map();
  for (const key of keys) {
    const node = map[key] || {};
    const inList = Array.isArray(node.in) ? node.in : [];
    const outList = Array.isArray(node.out) ? node.out : [];
    indegreeMap.set(key, inList.length);
    adjacency.set(key, toIdList(outList));
    reverseAdjacency.set(key, toIdList(inList));
  }

  const levelMap = new Map();

  const bfsFrom = (startKey) => {
    const queue = [startKey];
    if (!levelMap.has(startKey)) levelMap.set(startKey, 0);
    while (queue.length) {
      const current = queue.shift();
      const currentLevel = Number(levelMap.get(current) || 0);
      const nextList = adjacency.get(current) || [];
      for (const target of nextList) {
        if (!levelMap.has(target)) {
          levelMap.set(target, currentLevel + 1);
          queue.push(target);
        }
      }
    }
  };

  const preferredRoot = rootId == null ? null : String(rootId);
  if (preferredRoot && map[preferredRoot]) {
    bfsFrom(preferredRoot);
  }

  while (levelMap.size < keys.length) {
    const unvisited = keys.filter((key) => !levelMap.has(key));
    const nextRoot = pickRootKey(unvisited, indegreeMap);
    if (!nextRoot) break;
    bfsFrom(nextRoot);
  }

  const levelGroups = new Map();
  for (const key of keys) {
    const level = Number(levelMap.get(key) || 0);
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level).push(key);
  }

  for (const [level, group] of levelGroups.entries()) {
    group.sort(compareNodeKey);
    levelGroups.set(level, group);
  }

  const getSortedLevelEntries = () => [...levelGroups.entries()].sort((a, b) => a[0] - b[0]);
  const levelCount = levelGroups.size;
  let maxLevelLength = 0;
  const crossMap = new Map();
  for (const [level, group] of getSortedLevelEntries()) {
    if (group.length > maxLevelLength) maxLevelLength = group.length;
    const offset = (group.length - 1) / 2;
    for (let i = 0; i < group.length; i += 1) {
      const key = group[i];
      const cross = i - offset;
      crossMap.set(key, cross);
    }
  }
  const spaceScale = Math.max(1, levelCount, maxLevelLength) / Number(baseSpan);
  let xGap = base * ratio;
  let yGap = base;
  let symbolSize = base * 0.5;
  if (mode === 'compact') {
    symbolSize /= spaceScale;
  } else {
    xGap *= spaceScale;
    yGap *= spaceScale;
  }

  const estimateViewport = () => {
    const cols = direction === 'TB' ? Math.max(1, maxLevelLength) : Math.max(1, levelCount);
    const rows = direction === 'TB' ? Math.max(1, levelCount) : Math.max(1, maxLevelLength);
    const width = Math.ceil(cols > 1 ? ((cols - 1) * xGap + symbolSize) : symbolSize);
    const height = Math.ceil(rows > 1 ? ((rows - 1) * yGap + symbolSize) : symbolSize);
    return { width, height, area: width * height };
  };

  const maxAreaValue = Number(maxArea);
  if (Number.isFinite(maxAreaValue) && maxAreaValue > 0) {
    const estimated = estimateViewport();
    if (estimated.area > maxAreaValue) {
      const shrinkScale = Math.sqrt(estimated.area / maxAreaValue);
      xGap /= shrinkScale;
      yGap /= shrinkScale;
      symbolSize /= shrinkScale;
    }
  }

  const getBarycenter = (key, level, cross = Number(crossMap.get(key) || 0), reference = 'both') => {
    const neighbors = [];
    if (reference === 'prev' || reference === 'both') {
      const prev = reverseAdjacency.get(key) || [];
      for (const ref of prev) {
        if (Number(levelMap.get(ref) || 0) !== level - 1) continue;
        if (!crossMap.has(ref)) continue;
        neighbors.push(Number(crossMap.get(ref) || 0));
      }
    }
    if (reference === 'next' || reference === 'both') {
      const next = adjacency.get(key) || [];
      for (const ref of next) {
        if (Number(levelMap.get(ref) || 0) !== level + 1) continue;
        if (!crossMap.has(ref)) continue;
        neighbors.push(Number(crossMap.get(ref) || 0));
      }
    }
    if (!neighbors.length) return { barycenter: cross, weight: 0 };
    const barycenter = neighbors.reduce((sum, v) => sum + v, 0) / neighbors.length;
    return { barycenter, weight: neighbors.length };
  };

  const solveAssignment = (cost) => {
    const n = cost.length;
    if (!n) return [];
    const m = cost[0]?.length || 0;
    if (!m) return new Array(n).fill(-1);
    const u = new Array(n + 1).fill(0);
    const v = new Array(m + 1).fill(0);
    const p = new Array(m + 1).fill(0);
    const way = new Array(m + 1).fill(0);

    for (let i = 1; i <= n; i += 1) {
      p[0] = i;
      let j0 = 0;
      const minv = new Array(m + 1).fill(Infinity);
      const used = new Array(m + 1).fill(false);

      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity;
        let j1 = 0;
        for (let j = 1; j <= m; j += 1) {
          if (used[j]) continue;
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
        for (let j = 0; j <= m; j += 1) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }
        j0 = j1;
      } while (p[j0] !== 0);

      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0 !== 0);
    }

    const assignment = new Array(n).fill(-1);
    for (let j = 1; j <= m; j += 1) {
      if (p[j] > 0) assignment[p[j] - 1] = j - 1;
    }
    return assignment;
  };

  const optimizeLevel = (level, group, reference, maxLength) => {
    if (!Array.isArray(group) || group.length === 0) return false;
    const minGap = 1;
    let moved = false;

    const scored = [];
    for (let i = 0; i < group.length; i += 1) {
      const key = group[i];
      const cross = Number(crossMap.get(key) || 0);
      const { barycenter, weight } = getBarycenter(key, level, cross, reference);
      const target = Number.isFinite(barycenter) ? barycenter : cross;
      const w = Number.isFinite(weight) && weight > 0 ? weight : 0;
      scored.push({ key, target, weight: w, index: i });
    }

    const n = scored.length;
    const spanLength = Number.isFinite(maxLength) ? Math.max(1, Number(maxLength)) : maxLevelLength;
    const half = Math.max(0, (spanLength - 1) / 2);
    const lowerBound = -half;
    const upperBound = half;

    const phase = group.length % 2 === 0 ? 0.5 : 0;
    const slotStart = Math.ceil((lowerBound - phase) / minGap - EPSILON);
    const slotEnd = Math.floor((upperBound - phase) / minGap + EPSILON);
    const slots = [];
    for (let k = slotStart; k <= slotEnd; k += 1) {
      slots.push(phase + k * minGap);
    }

    if (slots.length < n) {
      const fallback = [...group];
      const offset = (fallback.length - 1) / 2;
      for (let i = 0; i < fallback.length; i += 1) {
        const nextCross = i - offset;
        if (Math.abs(nextCross - Number(crossMap.get(fallback[i]) || 0)) > EPSILON) moved = true;
        crossMap.set(fallback[i], nextCross);
      }
      levelGroups.set(level, fallback);
      return moved;
    }

    const slotCenter = (slots.length - 1) / 2;
    const nodeCenter = (n - 1) / 2;
    const cost = scored.map((node, nodeIndex) => slots.map((slot, slotIndex) => {
      const diff = slot - node.target;
      const baseCost = node.weight * diff * diff;
      const expectedSlot = nodeCenter > 0
        ? (nodeIndex / nodeCenter) * slotCenter
        : slotCenter;
      const tieBreak = (slotIndex - expectedSlot) * (slotIndex - expectedSlot) * EPSILON;
      return baseCost + tieBreak;
    }));
    const assignment = solveAssignment(cost);
    // console.log(level, scored.map((item) => ({...item, title: map[item.key].title})), cost, assignment);

    const placed = [];
    for (let i = 0; i < n; i += 1) {
      const slotIndex = assignment[i];
      const slot = slots[slotIndex];
      if (Math.abs(slot - Number(crossMap.get(scored[i].key) || 0)) > EPSILON) moved = true;
      crossMap.set(scored[i].key, slot);
      placed.push({ key: scored[i].key, cross: slot });
    }
    placed.sort((a, b) => (a.cross - b.cross) || compareNodeKey(a.key, b.key));
    levelGroups.set(level, placed.map((item) => item.key));
    return moved;
  };

  const layoutPasses = Array.isArray(passes)
    ? passes
      .map((pass) => {
        const reference = String(pass?.reference || '').toLowerCase();
        const nextReference = ['prev', 'next', 'both'].includes(reference) ? reference : 'both';
        return {
          reference: nextReference,
          spread: Boolean(pass?.spread),
        };
      })
      .filter((pass) => pass.reference)
    : [];
  const defaultPasses = [
    { reference: 'prev', spread: false },
    { reference: 'next', spread: false },
    { reference: 'prev', spread: false },
  ];
  if (spread) {
    defaultPasses.push(
      { reference: 'both', spread: true },
      { reference: 'both', spread: true },
    );
  }
  const resolvedPasses = layoutPasses.length
    ? layoutPasses
    : defaultPasses;
  const runPass = ({ reference, spread: useSpread }) => {
    let moved = false;
    for (const [level, group] of getSortedLevelEntries()) {
      if (level <= 0) continue;
      const maxLength = useSpread ? maxLevelLength : group.length;
      if (optimizeLevel(level, group, reference, maxLength)) {
        moved = true;
        console.log('moved', `${level} / ${levelCount}`, reference, moved);
      }
    }
    console.log('moved', `${levelCount} * ${maxLevelLength}`, reference, moved, useSpread ? 'spread' : 'non-spread');
    return moved;
  };
  for (const pass of resolvedPasses) {
    const moved = runPass(pass);
    // if (!moved) break;
  }

  const data = [];
  const nodePosMap = new Map();
  for (const [level, group] of getSortedLevelEntries()) {
    for (let i = 0; i < group.length; i += 1) {
      const key = group[i];
      const node = map[key] || {};
      const cross = Number(crossMap.get(key) || 0);
      const x = direction === 'TB' ? -cross * xGap : level * xGap;
      const y = direction === 'TB' ? level * yGap : cross * yGap;
      const name = typeof getNodeLabel === 'function'
        ? String(getNodeLabel(node, key) || '')
        : String(node?.title || `#${key}`);
      const value = typeof getNodeValue === 'function'
        ? getNodeValue(node, key)
        : node;
      data.push({
        id: key,
        name,
        x,
        y,
        symbolSize,
        value,
      });
      nodePosMap.set(key, { x, y });
    }
  }

  const edgePairCount = new Map();
  const links = [];
  for (const sourceKey of keys) {
    const node = map[sourceKey] || {};
    const outList = Array.isArray(node.out) ? node.out : [];
    for (const edge of outList) {
      if (edge?.id == null) continue;
      const targetKey = String(edge.id);
      if (!map[targetKey]) continue;
      const value = typeof getEdgeValue === 'function'
        ? getEdgeValue(edge, sourceKey, targetKey)
        : edge;

      const pairKey = sourceKey < targetKey
        ? `${sourceKey}<->${targetKey}`
        : `${targetKey}<->${sourceKey}`;
      const idx = Number(edgePairCount.get(pairKey) || 0);
      edgePairCount.set(pairKey, idx + 1);

      const sourceLevel = Number(levelMap.get(sourceKey) || 0);
      const targetLevel = Number(levelMap.get(targetKey) || 0);
      if (removeBackEdges && targetLevel < sourceLevel) continue;
      const flowDelta = targetLevel - sourceLevel;
      const sourcePos = nodePosMap.get(sourceKey) || { x: 0, y: 0 };
      const targetPos = nodePosMap.get(targetKey) || { x: 0, y: 0 };
      let baseCurve = 0.1;
      if (flowDelta <= 0) baseCurve = 0.3;
      const jitter = 0.1;
      const sourceCross = direction === 'TB' ? sourcePos.x : sourcePos.y;
      const targetCross = direction === 'TB' ? targetPos.x : targetPos.y;
      const axisSign = direction === 'TB' ? -1 : 1;
      let flowSign = flowDelta >= 0 ? 1 : -1;
      let baseSign = 0;
      if (sourceCross < -EPSILON) baseSign = 1;
      else if (sourceCross > EPSILON) baseSign = -1;
      else {
        if (targetCross < -EPSILON) baseSign = 1;
        else if (targetCross > EPSILON) baseSign = -1;
        else baseSign = 0;
      }
      if (flowDelta === 0) flowSign = axisSign * baseSign;
      const sign = flowSign * axisSign * baseSign;
      const curveness = sign !== 0
        ? sign * (baseCurve + idx * jitter)
        : (idx === 0 ? 0 : (idx % 2 === 1 ? 1 : -1) * Math.ceil(idx / 2) * jitter);

      const link = {
        source: sourceKey,
        target: targetKey,
        value,
        lineStyle: {
          curveness,
        },
      };
      links.push(link);
    }
  }

  const viewport = estimateViewport();

  return { data, links, meta: { levelMap, scale: spaceScale, viewport } };
};

export default layoutFlowGraph;
