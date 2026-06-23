export function buildGraphData(flatMembers, centerId, depth = 3) {
  if (!flatMembers?.length) {
    return { nodes: [], links: [], lineageNodes: [], unrenderedLineage: [] }
  }

  const memberMap = new Map(flatMembers.map(m => [m.id, m]))

  // BFS 标记直系血脉（不受 depth 限制）
  const lineageNodes = new Set()
  if (centerId && memberMap.has(centerId)) {
    const queue = [centerId]
    const visited = new Set()
    while (queue.length > 0) {
      const currentId = queue.shift()
      if (visited.has(currentId)) continue
      visited.add(currentId)
      lineageNodes.add(currentId)
      const member = memberMap.get(currentId)
      if (!member) continue
      if (member.father_id) queue.push(member.father_id)
      if (member.mother_id) queue.push(member.mother_id)
      flatMembers.forEach(m => {
        if (m.father_id === currentId || m.mother_id === currentId) queue.push(m.id)
      })
    }
  }

  // BFS 构图（depth 限制的视口）
  const visitedGraph = new Set()
  const queueGraph = [{ id: centerId || flatMembers[0]?.id, currentDepth: 0 }]
  const resultNodes = []
  const resultLinks = []
  const linkSet = new Set()

  while (queueGraph.length > 0) {
    const { id, currentDepth } = queueGraph.shift()
    if (visitedGraph.has(id) || currentDepth > depth) continue
    visitedGraph.add(id)
    const member = memberMap.get(id)
    if (!member) continue

    let category = 'member'
    if (member.id === centerId) category = 'center'
    else if (member.gender === 1) category = 'male'
    else if (member.gender === 2) category = 'female'

    resultNodes.push({
      id: member.id,
      name: member.name,
      category,
      symbolSize: member.id === centerId ? 60 : 40,
      isAlive: member.is_alive !== false,
      raw: member
    })

    const neighborIds = new Set()
    if (member.father_id) neighborIds.add(member.father_id)
    if (member.mother_id) neighborIds.add(member.mother_id)
    if (member.spouse_id) neighborIds.add(member.spouse_id)
    flatMembers.forEach(m => {
      if (m.father_id === id || m.mother_id === id) neighborIds.add(m.id)
    })

    neighborIds.forEach(neighborId => {
      const key = [id, neighborId].sort().join('-')
      if (!linkSet.has(key)) {
        linkSet.add(key)
        resultLinks.push({
          source: id,
          target: neighborId,
          isDirectLine: lineageNodes.has(id) && lineageNodes.has(neighborId)
        })
      }
      if (!visitedGraph.has(neighborId) && currentDepth + 1 <= depth) {
        queueGraph.push({ id: neighborId, currentDepth: currentDepth + 1 })
      }
    })
  }

  // 检测标记但未渲染的血脉节点
  const unrenderedLineage = []
  for (const lid of lineageNodes) {
    if (!visitedGraph.has(lid)) unrenderedLineage.push(lid)
  }
  resultLinks.forEach(link => {
    if (link.isDirectLine && unrenderedLineage.includes(link.target)) {
      link.showArrow = true
    }
  })

  return { nodes: resultNodes, links: resultLinks, lineageNodes: [...lineageNodes], unrenderedLineage }
}
