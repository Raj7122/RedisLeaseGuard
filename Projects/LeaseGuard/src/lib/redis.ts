import { createClient } from 'redis';

/**
 * Redis client configuration for LeaseGuard
 * Supports Vector Search, JSON, and Streams modules
 */
class RedisClient {
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected = false;

  /**
   * Initialize Redis client with vector search capabilities
   */
  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 10000,
          lazyConnect: true,
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

      await this.client.connect();
      
      // Initialize vector search index if it doesn't exist
      await this.initializeVectorIndex();
      
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
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
      console.error('Error initializing vector index:', error);
      // Don't throw - index might already exist
    }
  }

  /**
   * Get Redis client instance
   */
  getClient() {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected');
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
      if (!this.client || !this.isConnected) {
        return false;
      }
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
const redisClient = new RedisClient();

export default redisClient; 