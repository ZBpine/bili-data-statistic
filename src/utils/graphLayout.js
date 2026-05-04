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
  let maxLevelWidth = 0;
  const crossMap = new Map();
  let minCross = Infinity;
  let maxCross = -Infinity;
  for (const [level, group] of getSortedLevelEntries()) {
    if (group.length > maxLevelWidth) maxLevelWidth = group.length;
    const offset = (group.length - 1) / 2;
    for (let i = 0; i < group.length; i += 1) {
      const key = group[i];
      const cross = i - offset;
      crossMap.set(key, cross);
      if (cross < minCross) minCross = cross;
      if (cross > maxCross) maxCross = cross;
    }
  }
  if (!Number.isFinite(minCross) || !Number.isFinite(maxCross)) {
    minCross = 0;
    maxCross = 0;
  }
  const spaceScale = Math.max(1, levelCount, maxLevelWidth) / Number(baseSpan);
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
    const cols = direction === 'TB' ? Math.max(1, maxLevelWidth) : Math.max(1, levelCount);
    const rows = direction === 'TB' ? Math.max(1, levelCount) : Math.max(1, maxLevelWidth);
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

  const calcDelta = (key, level, cross = Number(crossMap.get(key) || 0), reference = 'prev') => {
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
    if (!neighbors.length) {
      let barycenter = cross;
      const compareGroupLength = (source, target) => {
        const sourceLength = levelGroups.get(source)?.length || 0;
        const targetLength = levelGroups.get(target)?.length || 0;
        return targetLength - sourceLength;
      };
      let lengthDelta = 0;
      if (reference === 'prev') lengthDelta = compareGroupLength(level - 1, level);
      else if (reference === 'next') lengthDelta = compareGroupLength(level + 1, level);
      if (lengthDelta < 0) barycenter = 0;
      else if (lengthDelta > 0) barycenter = cross <= 0 ? minCross - 1 : maxCross + 1;
      return { barycenter, dist: 0, delta: 0, sign: 0 };
    }
    const barycenter = neighbors.reduce((sum, v) => sum + v, 0) / neighbors.length;
    const raw = barycenter - cross;
    const dist = Math.abs(raw);
    const delta = dist * neighbors.length;
    const sign = raw > 0 ? 1 : (raw < 0 ? -1 : 0);
    return { barycenter, delta, dist, sign };
  };

  const sweepLevel = (level, reference) => {
    const group = levelGroups.get(level) || [];
    const nextGroup = [...group]
      .map((key, index) => ({
        key,
        barycenter: calcDelta(key, level, Number(crossMap.get(key) || 0), reference).barycenter,
        index,
      }))
      .sort((a, b) => (a.barycenter - b.barycenter) || (a.index - b.index))
      .map((item) => item.key);

    const offset = (nextGroup.length - 1) / 2;
    for (let i = 0; i < nextGroup.length; i += 1) {
      crossMap.set(nextGroup[i], i- offset);
    }
    levelGroups.set(level, nextGroup);
  };
  const relocateOnce = (level, group, reference) => {
    let moved = false;
    const order = [...group]
      .map((key, index) => ({
        key,
        dist: Math.abs(Number(crossMap.get(key) || 0)),
        index,
      }))
      .sort((a, b) => (b.dist - a.dist) || (a.index - b.index))
      .map((item) => item.key);
    for (const key of [...order, ...[...order].reverse()]) {
      while (true) {
        const currentCross = Number(crossMap.get(key) || 0);
        const before = calcDelta(key, level, currentCross, reference);
        if (!before.sign) break;
        const nextCross = currentCross + before.sign * 0.5;
        if (nextCross < minCross || nextCross > maxCross) break;

        const occupied = group.some((groupKey) => {
          if (groupKey === key) return false;
          const groupCross = Number(crossMap.get(groupKey) || 0);
          
          return (currentCross - groupCross) * (currentCross + before.sign - groupCross) <= 0;
        });
        if (occupied) break;

        const after = calcDelta(key, level, nextCross, reference);
        if (after.delta >= before.delta) break;

        crossMap.set(key, nextCross);
        moved = true;
      }
    }
    return moved;
  };
  const relocate = (level, group, reference) => {
    let moved = false;
    for (let i = 0; i < Math.max(1, group.length); i += 1) {
      if (!relocateOnce(level, group, reference)) break;
      moved = true;
    }
    return moved;
  };

  const orderedLevels = [...levelGroups.keys()].sort((a, b) => a - b);
  for (let i = 1; i < orderedLevels.length; i += 1) {
    sweepLevel(orderedLevels[i], 'prev');
  }
  for (let i = orderedLevels.length - 2; i > 0; i -= 1) {
    sweepLevel(orderedLevels[i], 'next');
  }
  for (let i = 1; i < orderedLevels.length; i += 1) {
    sweepLevel(orderedLevels[i], 'prev');
  }
  if (spread) {
    for (const [level, group] of getSortedLevelEntries()) {
      if (level <= 0) continue;
      relocate(level, group, 'both');
    }
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
