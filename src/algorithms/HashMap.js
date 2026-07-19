export default class HashMap {
  constructor(size = 137) {
    this.size = size;
    this.buckets = Array(size).fill(null).map(() => []);
  }

  hash(key) {
    let hashVal = 0;
    const str = String(key);
    for (let i = 0; i < str.length; i++) {
      hashVal = (hashVal * 31 + str.charCodeAt(i)) % this.size;
    }
    return hashVal;
  }

  put(key, value) {
    const index = this.hash(key);
    const bucket = this.buckets[index];
    
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket[i][1] = value;
        return;
      }
    }
    
    bucket.push([key, value]);
  }

  get(key) {
    const index = this.hash(key);
    const bucket = this.buckets[index];
    
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        return bucket[i][1];
      }
    }
    return null;
  }

  remove(key) {
    const index = this.hash(key);
    const bucket = this.buckets[index];
    
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  has(key) {
    return this.get(key) !== null;
  }

  clear() {
    this.buckets = Array(this.size).fill(null).map(() => []);
  }

  keys() {
    const allKeys = [];
    for (let i = 0; i < this.size; i++) {
      const bucket = this.buckets[i];
      for (let j = 0; j < bucket.length; j++) {
        allKeys.push(bucket[j][0]);
      }
    }
    return allKeys;
  }

  values() {
    const allValues = [];
    for (let i = 0; i < this.size; i++) {
      const bucket = this.buckets[i];
      for (let j = 0; j < bucket.length; j++) {
        allValues.push(bucket[j][1]);
      }
    }
    return allValues;
  }
}
