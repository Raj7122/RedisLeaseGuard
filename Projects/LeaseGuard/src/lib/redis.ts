import { createClient } from 'redis';

/**
 * Redis client configuration for LeaseGuard
 * Supports Vector Search, JSON, and Streams modules
 */
class RedisClient {
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  /**
   * Initialize Redis client with vector search capabilities
   */
  async connect(): Promise<void> {
    // If already connecting, wait for that connection
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If already connected, return immediately
    if (this.isConnected && this.client) {
      return;
    }

    this.connectionPromise = this._connect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _connect(): Promise<void> {
    try {
      // If no Redis URL is provided, skip connection for development
      if (!process.env.REDIS_URL) {
        console.log('No REDIS_URL provided - skipping Redis connection for development');
        this.isConnected = true; // Mark as connected to use mock client
        return;
      }

      this.client = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 10000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis connection failed after 10 retries');
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      // Error handling
      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('Redis Client Ready');
      });

      this.client.on('end', () => {
        console.log('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      
      // Initialize vector search index if it doesn't exist
      await this.initializeVectorIndex();
      
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      
      if (error instanceof Error && error.message.includes('WRONGPASS')) {
        throw new Error('Redis authentication failed. Please check your REDIS_URL credentials in .env.local');
      }
      throw new Error('Redis connection failed');
    }
  }

  /**
   * Initialize vector search index for clause similarity matching
   */
  private async initializeVectorIndex(): Promise<void> {
    if (!this.client) return;

    try {
      // Check if index already exists
      const indexExists = await this.client.ft.info('clause_idx').catch(() => false);
      
      if (!indexExists) {
        console.log('Creating vector search index...');
        
        // Create vector index for clause similarity search
        await this.client.ft.create('clause_idx', {
          '$.text': {
            type: 'TEXT',
            WEIGHT: 1.0,
          },
          '$.vector': {
            type: 'VECTOR',
            ALGORITHM: 'FLAT',
            TYPE: 'FLOAT32',
            DIM: 768,
            DISTANCE_METRIC: 'COSINE',
            INITIAL_CAP: 1000,
          },
          '$.metadata.leaseId': {
            type: 'TAG',
          },
          '$.metadata.severity': {
            type: 'TAG',
          },
          '$.metadata.flagged': {
            type: 'TAG',
          },
        }, {
          ON: 'JSON',
          PREFIX: 'clause:',
        });

        console.log('Vector search index created successfully');
      }
    } catch (error) {
      console.log('Error initializing vector index:', error);
      console.log('Vector search will be disabled - this is normal for basic Redis instances');
      // Don't throw - continue without vector search
    }
  }

  /**
   * Get Redis client instance with automatic connection
   */
  // Global mock storage for development
  private static mockStorage = new Map<string, any>();
  private static mockLists = new Map<string, string[]>();

  async getClient() {
    // If no Redis URL is provided, return a mock client for development
    if (!process.env.REDIS_URL) {
      console.log('No REDIS_URL provided - using mock Redis client for development');
      
      // Use global mock storage to persist data between calls
      const mockStorage = RedisClient.mockStorage;
      const mockLists = RedisClient.mockLists;
      
      return {
        json: {
          set: async (key: string, path: string, value: any) => {
            console.log(`Mock Redis: json.set ${key} ${path}`);
            mockStorage.set(key, value);
            return 'OK';
          },
          get: async (key: string) => {
            console.log(`Mock Redis: json.get ${key}`);
            return mockStorage.get(key) || null;
          },
        },
        expire: async (key: string, seconds: number) => {
          console.log(`Mock Redis: expire ${key} ${seconds}`);
          return 1;
        },
        ft: {
          search: async () => [],
          create: async () => console.log('Mock Redis: ft.create called'),
          info: async () => false,
        },
        ping: async () => 'PONG',
        lpush: async (key: string, value: string) => {
          console.log(`Mock Redis: lpush ${key} ${value}`);
          if (!mockLists.has(key)) {
            mockLists.set(key, []);
          }
          const list = mockLists.get(key)!;
          list.unshift(value);
          return list.length;
        },
        lrange: async (key: string, start: number, end: number) => {
          console.log(`Mock Redis: lrange ${key} ${start} ${end}`);
          const list = mockLists.get(key) || [];
          if (end === -1) end = list.length - 1;
          return list.slice(start, end + 1);
        },
        ltrim: async (key: string, start: number, end: number) => {
          console.log(`Mock Redis: ltrim ${key} ${start} ${end}`);
          const list = mockLists.get(key) || [];
          if (end === -1) end = list.length - 1;
          const trimmed = list.slice(start, end + 1);
          mockLists.set(key, trimmed);
          return 'OK';
        },
        xadd: async () => console.log('Mock Redis: xadd called'),
        xrange: async () => [],
        keys: async (pattern: string) => {
          console.log(`Mock Redis: keys ${pattern}`);
          const keys: string[] = [];
          for (const key of mockStorage.keys()) {
            if (key.includes(pattern.replace('*', ''))) {
              keys.push(key);
            }
          }
          return keys;
        },
      } as any;
    }
    
    // Ensure we're connected
    if (!this.isConnected || !this.client) {
      await this.connect();
    }
    
    // Double-check connection after connect attempt
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected after connection attempt');
    }
    
    return this.client;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // For development, if no Redis URL is provided, return true
      if (!process.env.REDIS_URL) {
        console.log('No REDIS_URL provided - running in development mode without Redis');
        return true;
      }
      
      if (!this.client || !this.isConnected) {
        return false;
      }
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      // If it's an authentication error, provide helpful message
      if (error instanceof Error && error.message.includes('WRONGPASS')) {
        console.error('Redis authentication failed. Please check your REDIS_URL credentials.');
      }
      return false;
    }
  }
}

// Singleton instance
const redisClient = new RedisClient();

export default redisClient; 