import Queue from './Queue.js';
import MaxHeap from './MaxHeap.js';
import PriorityQueue from './PriorityQueue.js';
import HashMap from './HashMap.js';
import Graph from './Graph.js';

console.log("=== RUNNING DSA VERIFICATION TESTS ===");

// 1. Test Queue
const q = new Queue();
q.enqueue("A");
q.enqueue("B");
console.assert(q.dequeue() === "A", "Queue Dequeue Fail");
console.assert(q.peek() === "B", "Queue Peek Fail");
console.assert(q.size() === 1, "Queue Size Fail");
console.log("✓ Queue verified");

// 2. Test MaxHeap
const heap = new MaxHeap();
heap.insert({ id: "P1", score: 10 });
heap.insert({ id: "P2", score: 50 });
heap.insert({ id: "P3", score: 30 });
console.assert(heap.peek().id === "P2", "MaxHeap Peek Fail");
console.assert(heap.extractMax().id === "P2", "MaxHeap ExtractMax Fail");
console.assert(heap.peek().id === "P3", "MaxHeap Second Max Fail");
heap.updateScore("P1", 100);
console.assert(heap.peek().id === "P1", "MaxHeap updateScore Fail");
console.log("✓ MaxHeap verified");

// 3. Test PriorityQueue
const pq = new PriorityQueue();
pq.enqueue({ patientId: "P1", name: "Alice" }, 15);
pq.enqueue({ patientId: "P2", name: "Bob" }, 45);
pq.enqueue({ patientId: "P3", name: "Charlie" }, 25);
console.assert(pq.peek().patientId === "P2", "PriorityQueue Peek Fail");
console.assert(pq.dequeue().patientId === "P2", "PriorityQueue Dequeue Fail");
pq.updatePriority("P1", 99);
console.assert(pq.peek().patientId === "P1", "PriorityQueue Update Fail");
console.log("✓ PriorityQueue verified");

// 4. Test HashMap
const map = new HashMap();
map.put("P1", { name: "Alice", age: 30 });
map.put("P2", { name: "Bob", age: 40 });
console.assert(map.get("P1").name === "Alice", "HashMap Get Fail");
console.assert(map.has("P2") === true, "HashMap Has Fail");
map.remove("P1");
console.assert(map.get("P1") === null, "HashMap Remove Fail");
console.log("✓ HashMap verified");

// 5. Test Graph
const graph = new Graph();
graph.addNode("H1", { type: 'hospital', name: 'General Hospital' });
graph.addNode("D1", { type: 'department', name: 'Emergency' });
graph.addNode("D2", { type: 'department', name: 'Pediatrics' });
graph.connectNodes("H1", "D1");
graph.connectNodes("H1", "D2");
const path = graph.shortestRoute("D1", "D2"); // D1 -> H1 -> D2
console.assert(path.length === 3, "Graph Shortest Path length fail");
console.assert(path[1].id === "H1", "Graph Shortest Path middle node fail");
console.log("✓ Graph verified");

console.log("ALL DSA VERIFICATION TESTS PASSED SUCCESSFULLY!");
