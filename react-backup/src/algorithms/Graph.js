export default class Graph {
  constructor() {
    this.adjacencyList = {};
    this.nodeData = {};
  }

  addNode(id, data = {}) {
    if (!this.adjacencyList[id]) {
      this.adjacencyList[id] = new Set();
      this.nodeData[id] = data;
    }
  }

  removeNode(id) {
    if (this.adjacencyList[id]) {
      for (const neighbor of this.adjacencyList[id]) {
        this.adjacencyList[neighbor].delete(id);
      }
      delete this.adjacencyList[id];
      delete this.nodeData[id];
      return true;
    }
    return false;
  }

  connectNodes(id1, id2, bidirectional = true) {
    if (this.adjacencyList[id1] && this.adjacencyList[id2]) {
      this.adjacencyList[id1].add(id2);
      if (bidirectional) {
        this.adjacencyList[id2].add(id1);
      }
      return true;
    }
    return false;
  }

  disconnectNodes(id1, id2, bidirectional = true) {
    if (this.adjacencyList[id1] && this.adjacencyList[id2]) {
      this.adjacencyList[id1].delete(id2);
      if (bidirectional) {
        this.adjacencyList[id2].delete(id1);
      }
      return true;
    }
    return false;
  }

  findDoctor(doctorId) {
    return this.nodeData[doctorId] && this.nodeData[doctorId].type === 'doctor' 
      ? this.nodeData[doctorId] 
      : null;
  }

  findDepartment(deptId) {
    return this.nodeData[deptId] && this.nodeData[deptId].type === 'department'
      ? this.nodeData[deptId]
      : null;
  }

  shortestRoute(startId, endId) {
    if (!this.adjacencyList[startId] || !this.adjacencyList[endId]) return null;

    const queue = [startId];
    const visited = new Set([startId]);
    const parent = {};

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === endId) {
        const path = [];
        let curr = endId;
        while (curr) {
          path.push({ id: curr, ...this.nodeData[curr] });
          curr = parent[curr];
        }
        return path.reverse();
      }

      for (const neighbor of this.adjacencyList[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent[neighbor] = current;
          queue.push(neighbor);
        }
      }
    }
    return null;
  }

  getTreeStructure() {
    const rootIds = Object.keys(this.nodeData).filter(id => this.nodeData[id].type === 'hospital');
    const getChildren = (id, visited = new Set()) => {
      visited.add(id);
      const children = [];
      for (const neighbor of this.adjacencyList[id]) {
        if (!visited.has(neighbor)) {
          const parentType = this.nodeData[id].type;
          const childType = this.nodeData[neighbor].type;
          if (
            (parentType === 'hospital' && childType === 'department') ||
            (parentType === 'department' && childType === 'doctor') ||
            (parentType === 'doctor' && childType === 'patient')
          ) {
            children.push({
              id: neighbor,
              ...this.nodeData[neighbor],
              children: getChildren(neighbor, new Set(visited))
            });
          }
        }
      }
      return children;
    };

    return rootIds.map(id => ({
      id,
      ...this.nodeData[id],
      children: getChildren(id)
    }));
  }
}
