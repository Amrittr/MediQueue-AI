export default class MaxHeap {
  constructor() {
    this.heap = [];
  }

  getParentIndex(i) {
    return Math.floor((i - 1) / 2);
  }

  getLeftChildIndex(i) {
    return 2 * i + 1;
  }

  getRightChildIndex(i) {
    return 2 * i + 2;
  }

  swap(i1, i2) {
    const temp = this.heap[i1];
    this.heap[i1] = this.heap[i2];
    this.heap[i2] = temp;
  }

  peek() {
    if (this.heap.length === 0) return null;
    return this.heap[0];
  }

  size() {
    return this.heap.length;
  }

  insert(item) {
    // item is expected to have { id, score }
    this.heap.push(item);
    this.heapifyUp(this.heap.length - 1);
  }

  extractMax() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const max = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.heapifyDown(0);
    return max;
  }

  heapifyUp(index) {
    let currentIndex = index;
    while (currentIndex > 0) {
      const parentIndex = this.getParentIndex(currentIndex);
      if (this.heap[currentIndex].score > this.heap[parentIndex].score) {
        this.swap(currentIndex, parentIndex);
        currentIndex = parentIndex;
      } else {
        break;
      }
    }
  }

  heapifyDown(index) {
    let currentIndex = index;
    const length = this.heap.length;

    while (this.getLeftChildIndex(currentIndex) < length) {
      let largerChildIndex = this.getLeftChildIndex(currentIndex);
      const rightChildIndex = this.getRightChildIndex(currentIndex);

      if (
        rightChildIndex < length &&
        this.heap[rightChildIndex].score > this.heap[largerChildIndex].score
      ) {
        largerChildIndex = rightChildIndex;
      }

      if (this.heap[currentIndex].score < this.heap[largerChildIndex].score) {
        this.swap(currentIndex, largerChildIndex);
        currentIndex = largerChildIndex;
      } else {
        break;
      }
    }
  }

  // Helper method to find if an item exists and update it
  updateScore(id, newScore) {
    const index = this.heap.findIndex(item => item.id === id);
    if (index === -1) return false;

    const oldScore = this.heap[index].score;
    this.heap[index].score = newScore;

    if (newScore > oldScore) {
      this.heapifyUp(index);
    } else {
      this.heapifyDown(index);
    }
    return true;
  }

  // Remove an item from the heap
  remove(id) {
    const index = this.heap.findIndex(item => item.id === id);
    if (index === -1) return false;

    if (index === this.heap.length - 1) {
      this.heap.pop();
      return true;
    }

    this.swap(index, this.heap.length - 1);
    this.heap.pop();

    // Re-heapify from the swapped index
    this.heapifyDown(index);
    this.heapifyUp(index);
    return true;
  }

  toArray() {
    return [...this.heap];
  }
}
