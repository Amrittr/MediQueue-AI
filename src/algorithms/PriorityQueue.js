import MaxHeap from './MaxHeap.js';

export default class PriorityQueue {
  constructor() {
    this.heap = new MaxHeap();
  }

  enqueue(patient, score) {
    this.heap.insert({
      id: patient.patientId,
      score: score,
      patient: patient
    });
  }

  dequeue() {
    const maxNode = this.heap.extractMax();
    return maxNode ? maxNode.patient : null;
  }

  peek() {
    const maxNode = this.heap.peek();
    return maxNode ? maxNode.patient : null;
  }

  updatePriority(patientId, newScore) {
    const success = this.heap.updateScore(patientId, newScore);
    if (success) {
      const node = this.heap.heap.find(item => item.id === patientId);
      if (node && node.patient) {
        node.patient.priorityScore = newScore;
      }
    }
    return success;
  }

  remove(patientId) {
    return this.heap.remove(patientId);
  }

  isEmpty() {
    return this.heap.size() === 0;
  }

  size() {
    return this.heap.size();
  }

  getSortedPatients() {
    // Clone heap to extract elements without modifying original
    const tempHeap = new MaxHeap();
    tempHeap.heap = this.heap.toArray().map(item => ({ ...item }));
    
    const sorted = [];
    while (tempHeap.size() > 0) {
      const node = tempHeap.extractMax();
      sorted.push(node.patient);
    }
    return sorted;
  }
}
