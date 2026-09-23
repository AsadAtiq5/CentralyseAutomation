class CacheManager {
  constructor() {
    if (CacheManager.instance) {
      return CacheManager.instance;
    }

    this.cache = {
      frameworks: {},
    };

    CacheManager.instance = this;
  }

  // Save data in a namespace
  set(namespace, key, value, subKey) {
    if (!this.cache[namespace]) {
      this.cache[namespace] = {};
    }

    if (subKey) {
      if (!this.cache[namespace][key]) {
        this.cache[namespace][key] = {};
      }
      this.cache[namespace][key][subKey] = value;
    } else {
      if (key !== '' && key !== undefined && key !== null){
        this.cache[namespace][key] = value;
      }else{
        this.cache[namespace]={...value}
      }
    }
  }

  // Get data from namespace
  get(namespace, key, subKey) {
    if (!this.cache[namespace]) return undefined;
    if (subKey) {
      return this.cache[namespace][key]?.[subKey];
    }
    return this.cache[namespace][key];
  }

  // Check if key exists
  has(namespace, key, subKey) {
    if (!this.cache[namespace]) return false;
    if (subKey) {
      return this.cache[namespace][key]?.[subKey] !== undefined;
    }
    return this.cache[namespace][key] !== undefined;
  }

  // Delete specific key
  delete(namespace, key, subKey) {
    if (!this.cache[namespace]) return;
    if (subKey && this.cache[namespace][key]) {
      delete this.cache[namespace][key][subKey];
    } else {
      delete this.cache[namespace][key];
    }
  }

  // Clear everything
  clear() {
    Object.keys(this.cache).forEach(ns => {
      this.cache[ns] = {};
    });
  }
}

module.exports = new CacheManager();
