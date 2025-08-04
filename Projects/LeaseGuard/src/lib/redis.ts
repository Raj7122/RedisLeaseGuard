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
  private static mockStreams: Map<string, any[]> | null = null;
  private static mockChannels: Map<string, any[]> | null = null;

  async getClient() {
    // If no Redis URL is provided or in test environment, return a mock client
    if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
      console.log('Using mock Redis client for development/testing');
      
      // Use global mock storage to persist data between calls
      const mockStorage = RedisClient.mockStorage;
      const mockLists = RedisClient.mockLists;
      
      // Use static maps to persist data across calls
      if (!RedisClient.mockStreams) {
        RedisClient.mockStreams = new Map<string, any[]>();
      }
      if (!RedisClient.mockChannels) {
        RedisClient.mockChannels = new Map<string, any[]>();
      }
      
      const mockStreams = RedisClient.mockStreams;
      const mockChannels = RedisClient.mockChannels;
      
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
        xadd: async (stream: string, id: string, ...args: string[]) => {
          console.log(`Mock Redis: xadd ${stream} ${id}`, args);
          if (!mockStreams.has(stream)) {
            mockStreams.set(stream, []);
          }
          const streamData = mockStreams.get(stream)!;
          const event = { id, fields: args };
          streamData.push(event);
          return id;
        },
        xrange: async (stream: string, start: string, end: string, count?: number) => {
          console.log(`Mock Redis: xrange ${stream} ${start} ${end}`);
          const streamData = mockStreams.get(stream) || [];
          console.log(`Mock Redis: stream data for ${stream}:`, streamData);
          return streamData.slice(0, count || 100);
        },
        publish: async (channel: string, message: string) => {
          console.log(`Mock Redis: publish ${channel}`, message);
          if (!mockChannels.has(channel)) {
            mockChannels.set(channel, []);
          }
          const channelData = mockChannels.get(channel)!;
          channelData.push(message);
          return 1; // Return number of subscribers
        },
        subscribe: async (channel: string, callback: (message: string) => void) => {
          console.log(`Mock Redis: subscribe ${channel}`);
          // Mock subscription - in real implementation this would handle callbacks
          return {
            unsubscribe: async () => console.log(`Mock Redis: unsubscribe ${channel}`)
          };
        },
        duplicate: () => ({
          subscribe: async (channel: string, callback: (message: string) => void) => {
            console.log(`Mock Redis: duplicate subscribe ${channel}`);
            return {
              unsubscribe: async () => console.log(`Mock Redis: duplicate unsubscribe ${channel}`)
            };
          }
        }),
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
   * Subscribe to processing events from Redis Streams
   */
  async subscribeToProcessingEvents(callback: (event: any) => void) {
    const redis = await this.getClient();
    
    // For mock client, simulate event subscription
    if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
      console.log('Mock Redis: Subscribing to processing events');
      return {
        unsubscribe: async () => console.log('Mock Redis: Unsubscribed from processing events')
      };
    }
    
    // Subscribe to processing events
    const subscriber = redis.duplicate();
    await subscriber.subscribe('lease_processing_stream', (message) => {
      const event = JSON.parse(message);
      callback(event);
    });
    
    return subscriber;
  }

  /**
   * Subscribe to violation alerts from Redis Pub/Sub
   */
  async subscribeToViolationAlerts(callback: (alert: any) => void) {
    const redis = await this.getClient();
    
    // For mock client, simulate alert subscription
    if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
      console.log('Mock Redis: Subscribing to violation alerts');
      return {
        unsubscribe: async () => console.log('Mock Redis: Unsubscribed from violation alerts')
      };
    }
    
    // Subscribe to violation alerts
    const subscriber = redis.duplicate();
    await subscriber.subscribe('violation_alerts', (message) => {
      const alert = JSON.parse(message);
      callback(alert);
    });
    
    return subscriber;
  }

  /**
   * Get recent events from a stream
   */
  async getEventStream(streamName: string, startId: string = '0'): Promise<any[]> {
    // For mock client, access the static storage directly
    if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
      const mockStreams = RedisClient.mockStreams;
      if (!mockStreams) {
        console.log(`getEventStream: no mock streams available for ${streamName}`);
        return [];
      }
      
      const streamData = mockStreams.get(streamName) || [];
      console.log(`getEventStream: mock stream data for ${streamName}:`, streamData);
      
      if (streamData.length > 0) {
        const result = streamData.map((event: any) => {
          // Fields are stored as [key1, value1, key2, value2, ...]
          const fields = event.fields;
          const eventTypeIndex = fields.indexOf('eventType');
          const dataIndex = fields.indexOf('data');
          const timestampIndex = fields.indexOf('timestamp');
          
          return {
            id: event.id,
            type: eventTypeIndex >= 0 ? fields[eventTypeIndex + 1] : 'unknown',
            data: dataIndex >= 0 ? JSON.parse(fields[dataIndex + 1]) : {},
            timestamp: timestampIndex >= 0 ? fields[timestampIndex + 1] : new Date().toISOString()
          };
        });
        console.log(`getEventStream: processed mock events:`, result);
        return result;
      }
      
      console.log(`getEventStream: no events found for ${streamName}`);
      return [];
    }
    
    // For real Redis client
    const redis = await this.getClient();
    
    try {
      const events = await redis.xrange(streamName, startId, '+', 'COUNT', 100);
      console.log(`getEventStream: raw events for ${streamName}:`, events);
      
      // Handle real Redis format: [id, [field1, value1, field2, value2, ...]]
      if (Array.isArray(events) && events.length > 0) {
        const result = events.map(([id, fields]) => ({
          id,
          type: fields[1],
          data: JSON.parse(fields[3]),
          timestamp: fields[5]
        }));
        console.log(`getEventStream: processed real Redis events:`, result);
        return result;
      }
      
      console.log(`getEventStream: no events found for ${streamName}`);
      return [];
    } catch (error) {
      console.error('Error getting event stream:', error);
      return [];
    }
  }

  /**
   * Add data point to TimeSeries
   */
  async addTimeSeriesData(key: string, timestamp: number, value: number): Promise<void> {
    const redis = await this.getClient();
    
    try {
      // For mock client, simulate TimeSeries
      if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
        console.log(`Mock Redis: Adding TimeSeries data for ${key}: ${value} at ${timestamp}`);
        return;
      }
      
      await redis.ts.add(key, timestamp, value);
    } catch (error) {
      console.error(`Error adding TimeSeries data for ${key}:`, error);
      // Don't throw - TimeSeries failures shouldn't block main functionality
    }
  }

  /**
   * Get TimeSeries data range
   */
  async getTimeSeriesData(key: string, fromTimestamp: number, toTimestamp: number): Promise<any[]> {
    const redis = await this.getClient();
    
    try {
      // For mock client, return empty array
      if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
        console.log(`Mock Redis: Getting TimeSeries data for ${key} from ${fromTimestamp} to ${toTimestamp}`);
        return [];
      }
      
      const data = await redis.ts.range(key, fromTimestamp, toTimestamp);
      return data || [];
    } catch (error) {
      console.error(`Error getting TimeSeries data for ${key}:`, error);
      return [];
    }
  }

  /**
   * Get TimeSeries statistics
   */
  async getTimeSeriesStats(key: string, fromTimestamp: number, toTimestamp: number): Promise<any> {
    const redis = await this.getClient();
    
    try {
      // For mock client, return mock stats
      if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
        console.log(`Mock Redis: Getting TimeSeries stats for ${key}`);
        return {
          count: 0,
          min: 0,
          max: 0,
          avg: 0,
          sum: 0
        };
      }
      
      const stats = await redis.ts.info(key);
      return stats;
    } catch (error) {
      console.error(`Error getting TimeSeries stats for ${key}:`, error);
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        sum: 0
      };
    }
  }

  /**
   * Perform hybrid search combining vector and text search
   */
  async hybridSearch(query: string, leaseId: string, filters?: any): Promise<any[]> {
    const redis = await this.getClient();
    
    try {
      // For mock client, return mock results
      if (!process.env.REDIS_URL || process.env.NODE_ENV === 'test') {
        console.log(`Mock Redis: Performing hybrid search for "${query}" in lease ${leaseId}`);
        return [
          {
            id: 'mock-clause-1',
            text: 'Sample lease clause matching query',
            score: 0.95,
            metadata: {
              leaseId,
              flagged: false,
              severity: 'Low'
            }
          }
        ];
      }
      
      // Generate query embedding (this would need to be implemented with your embedding service)
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Build hybrid search query
      const searchQuery = this.buildHybridQuery(query, queryEmbedding, filters);
      
      // Execute hybrid search
      const results = await redis.ft.search('clause_idx', searchQuery, {
        PARAMS: {
          vector: Buffer.from(Float32Array.from(queryEmbedding).buffer)
        },
        RETURN: ['text', 'metadata', 'score'],
        SORTBY: 'score',
        LIMIT: { from: 0, size: 10 }
      });
      
      return this.processSearchResults(results);
    } catch (error) {
      console.error(`Error performing hybrid search:`, error);
      return [];
    }
  }

  /**
   * Build hybrid search query combining text and vector search
   */
  private buildHybridQuery(textQuery: string, vector: number[], filters: any): string {
    let query = '';
    
    // Text search component
    if (textQuery) {
      query += `(@text:"${textQuery}") `;
    }
    
    // Filter components
    if (filters?.leaseId) {
      query += `(@metadata.leaseId:${filters.leaseId}) `;
    }
    
    if (filters?.severity) {
      query += `(@metadata.severity:${filters.severity}) `;
    }
    
    if (filters?.flagged !== undefined) {
      query += `(@metadata.flagged:${filters.flagged}) `;
    }
    
    // Vector search component
    query += `=>[KNN 10 @vector $vector AS score]`;
    
    return query;
  }

  /**
   * Process search results
   */
  private processSearchResults(results: any[]): any[] {
    if (!Array.isArray(results) || results.length === 0) {
      return [];
    }
    
    return results.map(([id, fields]) => ({
      id,
      text: fields[1],
      metadata: JSON.parse(fields[3]),
      score: parseFloat(fields[5])
    }));
  }

  /**
   * Generate embedding for text (placeholder - implement with your embedding service)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // This is a placeholder - you would implement this with your embedding service
    // For now, return a mock embedding
    return new Array(1536).fill(0.1); // Mock 1536-dimensional embedding
  }

  /**
   * Append event to event store (Event Sourcing)
   */
  async appendEvent(streamName: string, eventData: any): Promise<string> {
    const redis = await this.getClient();
    
    try {
      const event = {
        ...eventData,
        timestamp: new Date().toISOString(),
        eventId: this.generateEventId()
      };
      
      const eventId = await redis.xadd(streamName, '*', 
        'eventId', event.eventId,
        'type', event.type,
        'data', JSON.stringify(event.data),
        'timestamp', event.timestamp
      );
      
      console.log(`Appended event ${event.eventId} to stream ${streamName}`);
      return eventId;
    } catch (error) {
      console.error(`Error appending event to stream ${streamName}:`, error);
      throw error;
    }
  }

  /**
   * Get event stream for event sourcing
   */
  async getEventStreamForSourcing(streamName: string, startId: string = '0'): Promise<any[]> {
    const redis = await this.getClient();
    
    try {
      const events = await redis.xrange(streamName, startId, '+', 'COUNT', 100);
      
      return events.map(([id, fields]) => ({
        id,
        eventId: fields[1],
        type: fields[3],
        data: JSON.parse(fields[5]),
        timestamp: fields[7]
      }));
    } catch (error) {
      console.error(`Error getting event stream for sourcing ${streamName}:`, error);
      return [];
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store command in command store (CQRS)
   */
  async storeCommand(command: any): Promise<string> {
    const redis = await this.getClient();
    
    try {
      const commandData = {
        ...command,
        timestamp: new Date().toISOString(),
        commandId: this.generateCommandId()
      };
      
      const commandId = await redis.xadd('commands', '*', 
        'commandId', commandData.commandId,
        'type', commandData.type,
        'data', JSON.stringify(commandData.data),
        'timestamp', commandData.timestamp
      );
      
      console.log(`Stored command ${commandData.commandId}`);
      return commandId;
    } catch (error) {
      console.error('Error storing command:', error);
      throw error;
    }
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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