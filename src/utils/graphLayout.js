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
    layoutRatio = 2,
    baseGap = 100,
    baseSpan = 4,
    maxArea = 100_000_000,
    removeBackEdges = false,
    getNodeLabel,
    getNodeValue,
    getEdgeLabel,
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

  const orderedLevels = [...levelGroups.keys()].sort((a, b) => a - b);
  const reorderByBarycenter = (sourceLevel, targetLevel, getRefs) => {
    const sourceGroup = levelGroups.get(sourceLevel) || [];
    const sourceIndexMap = new Map(sourceGroup.map((key, index) => [key, index]));
    const group = levelGroups.get(targetLevel) || [];
    const groupCenter = (group.length - 1) / 2;
    const nextGroup = [...group]
      .map((key, index) => {
        const indexes = getRefs(key)
          .filter((refKey) => Number(levelMap.get(refKey) || 0) === sourceLevel)
          .map((refKey) => sourceIndexMap.get(refKey))
          .filter((value) => Number.isFinite(value));
        let barycenter;
        if (indexes.length) {
          barycenter = indexes.reduce((sum, value) => sum + value, 0) / indexes.length;
        } else {
          barycenter = index <= groupCenter ? -1 : sourceGroup.length + 1;
        }
        return { key, index, barycenter };
      })
      .sort((a, b) => {
        if (a.barycenter !== b.barycenter) return a.barycenter - b.barycenter;
        return a.index - b.index;
      })
      .map((item) => item.key);
    levelGroups.set(targetLevel, nextGroup);
  };

  for (let i = 1; i < orderedLevels.length; i += 1) {
    const level = orderedLevels[i];
    const prevLevel = orderedLevels[i - 1];
    reorderByBarycenter(prevLevel, level, (key) => reverseAdjacency.get(key) || []);
  }
  for (let i = orderedLevels.length - 2; i >= 0; i -= 1) {
    const level = orderedLevels[i];
    const nextLevel = orderedLevels[i + 1];
    reorderByBarycenter(nextLevel, level, (key) => adjacency.get(key) || []);
  }
  for (let i = 1; i < orderedLevels.length; i += 1) {
    const level = orderedLevels[i];
    const prevLevel = orderedLevels[i - 1];
    reorderByBarycenter(prevLevel, level, (key) => reverseAdjacency.get(key) || []);
  }

  const levelCount = levelGroups.size;
  let maxLevelWidth = 0;
  for (const group of levelGroups.values()) {
    if (group.length > maxLevelWidth) maxLevelWidth = group.length;
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

  const data = [];
  const nodePosMap = new Map();
  for (const [level, group] of [...levelGroups.entries()].sort((a, b) => a[0] - b[0])) {
    const offset = (group.length - 1) / 2;
    for (let i = 0; i < group.length; i += 1) {
      const key = group[i];
      const node = map[key] || {};
      const x = direction === 'TB' ? -(i - offset) * xGap : level * xGap;
      const y = direction === 'TB' ? level * yGap : (i - offset) * yGap;
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
      const optionLabel = typeof getEdgeLabel === 'function'
        ? String(getEdgeLabel(edge, sourceKey, targetKey) || '')
        : String(edge?.option || '');

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
      const jitter = idx * 0.1;
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
      const curveness = sign * (baseCurve + jitter);

      links.push({
        source: sourceKey,
        target: targetKey,
        label: optionLabel,
        lineStyle: {
          curveness,
        },
      });
    }
  }

  const viewport = estimateViewport();

  return { data, links, meta: { levelMap, scale: spaceScale, viewport } };
};

export default layoutFlowGraph;
