/**
 * tests/setup.js - Test setup and mock implementations
 *
 * Provides mock implementations for browser, proxy, S3, and Supabase
 * used in unit and integration tests.
 */

/**
 * MockBrowser - Mock implementation of browser pool
 */
class MockBrowser {
  constructor() {
    this.pages = [];
  }

  async newPage() {
    const page = new MockPage();
    this.pages.push(page);
    return page;
  }

  async close() {
    this.pages = [];
  }
}

/**
 * MockPage - Mock browser page
 */
class MockPage {
  constructor() {
    this.url = '';
    this.content = '';
    this.errors = [];
    this.listeners = {};
  }

  async goto(url, options = {}) {
    this.url = url;
    // Simulate network delay
    return new Promise(resolve => setTimeout(resolve, 10));
  }

  async evaluate(fn, ...args) {
    // Mock DOM evaluation
    if (fn.toString().includes('document.querySelectorAll')) {
      return [];
    }
    if (fn.toString().includes('navigator.userAgent')) {
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    }
    return null;
  }

  async $ (selector) {
    return new MockElement(selector);
  }

  async $$ (selector) {
    return [new MockElement(selector)];
  }

  async screenshot(options = {}) {
    return Buffer.from('fake-screenshot-data');
  }

  async close() {
    // Cleanup
  }

  on(eventName, handler) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(handler);
  }

  emit(eventName, ...args) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach(handler => handler(...args));
    }
  }
}

/**
 * MockElement - Mock DOM element
 */
class MockElement {
  constructor(selector) {
    this.selector = selector;
  }

  async click() {
    // Mock click
    return true;
  }

  async evaluate(fn) {
    return null;
  }
}

/**
 * MockProxy - Mock proxy manager
 */
class MockProxy {
  constructor() {
    this.currentZone = 'default';
    this.rotations = 0;
  }

  async rotate() {
    this.rotations++;
    this.currentZone = `zone-${this.rotations % 5}`;
    return this.currentZone;
  }

  async getStatus() {
    return {
      zone: this.currentZone,
      isActive: true,
      rotations: this.rotations
    };
  }

  setUserAgent(ua) {
    this.userAgent = ua;
  }

  setCookie(name, value) {
    this.cookies = this.cookies || {};
    this.cookies[name] = value;
  }
}

/**
 * MockS3 - Mock S3 client
 */
class MockS3 {
  constructor() {
    this.uploads = [];
  }

  async uploadBase64(key, base64Data, contentType = 'image/png') {
    const url = `https://mock-s3.example.com/${key}`;
    this.uploads.push({ key, url, timestamp: Date.now() });
    return url;
  }

  async getURL(key) {
    const upload = this.uploads.find(u => u.key === key);
    return upload ? upload.url : null;
  }

  async delete(key) {
    this.uploads = this.uploads.filter(u => u.key !== key);
    return true;
  }
}

/**
 * MockSupabase - Mock Supabase client
 */
class MockSupabase {
  constructor() {
    this.data = {}; // Store by table name
  }

  from(tableName) {
    return new MockSupabaseQuery(this, tableName);
  }
}

/**
 * MockSupabaseQuery - Mock Supabase query builder
 */
class MockSupabaseQuery {
  constructor(client, tableName) {
    this.client = client;
    this.tableName = tableName;
    this.filters = [];
    this.selectFields = '*';
  }

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value, operator: 'eq' });
    return this;
  }

  single() {
    // Returns a promise that resolves with data
    return {
      data: this.executeFilters(),
      error: null
    };
  }

  async insert(data) {
    if (!this.client.data[this.tableName]) {
      this.client.data[this.tableName] = [];
    }
    this.client.data[this.tableName].push(data);
    return {
      data: [data],
      error: null
    };
  }

  async update(data) {
    if (!this.client.data[this.tableName]) {
      this.client.data[this.tableName] = [];
    }
    // Mock update by replacing if exists
    const idx = this.client.data[this.tableName].findIndex(row =>
      this.matchesFilters(row)
    );
    if (idx >= 0) {
      this.client.data[this.tableName][idx] = {
        ...this.client.data[this.tableName][idx],
        ...data
      };
    }
    return { data: [data], error: null };
  }

  async upsert(data, options = {}) {
    if (!this.client.data[this.tableName]) {
      this.client.data[this.tableName] = [];
    }
    const existing = this.client.data[this.tableName].find(row =>
      this.matchesFilters(row, data)
    );
    if (existing) {
      Object.assign(existing, data);
    } else {
      this.client.data[this.tableName].push(data);
    }
    return { data: [data], error: null };
  }

  executeFilters() {
    if (!this.client.data[this.tableName]) {
      return null;
    }
    const rows = this.client.data[this.tableName];
    let result = rows.find(row => this.matchesFilters(row));
    return result || null;
  }

  matchesFilters(row, checkData = null) {
    const data = checkData || row;
    return this.filters.every(f => {
      if (f.operator === 'eq') {
        return data[f.column] === f.value;
      }
      return false;
    });
  }
}

/**
 * Create a mock logger for testing
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

/**
 * Create a mock memory service
 */
function createMockMemory() {
  return {
    createSession: jest.fn(),
    getSession: jest.fn(),
    updateSession: jest.fn(),
    loadProfile: jest.fn(),
    updateProfile: jest.fn(),
    clearSession: jest.fn(),
    getMetadata: jest.fn(() => ({
      activeSessions: 0
    }))
  };
}

// Export for CommonJS
module.exports = {
  MockBrowser,
  MockPage,
  MockElement,
  MockProxy,
  MockS3,
  MockSupabase,
  MockSupabaseQuery,
  createMockLogger,
  createMockMemory
};

// Global test utilities
global.MockBrowser = MockBrowser;
global.MockProxy = MockProxy;
global.MockS3 = MockS3;
global.MockSupabase = MockSupabase;
