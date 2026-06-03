import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http } from './http';

// Mock the runtime module
vi.mock('./runtime', () => ({
  apiRuntime: {
    baseUrl: 'http://test.local:3001',
  },
  buildApiUrl: (path: string) => `http://test.local:3001${path}`,
}));

// Mock the mockAuth module
vi.mock('../mockAuth', () => ({
  getAccessToken: () => null,
  getRefreshToken: () => null,
  clearAuthSession: () => {},
  updateAuthTokens: () => {},
}));

// Mock the networkActivity module
vi.mock('../networkActivity', () => ({
  beginNetworkActivity: () => {},
  endNetworkActivity: () => {},
}));

describe('HTTP Client Error Handling (PR #152)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('JSON error bodies', () => {
    it('should extract message from JSON error response', async () => {
      const errorResponse = new Response(
        JSON.stringify({ message: 'User not found', requestId: 'req-123' }),
        {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchMock.mockResolvedValueOnce(errorResponse);

      await expect(http.get('/users/999')).rejects.toThrow('User not found');
    });

    it('should extract error field if message is not present', async () => {
      const errorResponse = new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchMock.mockResolvedValueOnce(errorResponse);

      await expect(http.post('/auth/login', {})).rejects.toThrow('Invalid credentials');
    });

    it('should use requestId from JSON body when present', async () => {
      const errorResponse = new Response(
        JSON.stringify({ message: 'Database error', requestId: 'req-456' }),
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchMock.mockResolvedValueOnce(errorResponse);

      try {
        await http.get('/data');
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBe('Database error [request req-456]');
      }
    });

    it('should fall back to header requestId when not in JSON body', async () => {
      const errorResponse = new Response(
        JSON.stringify({ message: 'Server error' }),
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': 'header-req-789',
          },
        }
      );
      fetchMock.mockResolvedValueOnce(errorResponse);

      try {
        await http.get('/data');
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBe('Server error [request header-req-789]');
      }
    });
  });

  describe('Plain text error bodies', () => {
    it('should use plain text error message', async () => {
      const errorResponse = new Response('Service temporarily unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
      fetchMock.mockResolvedValueOnce(errorResponse);

      await expect(http.get('/health')).rejects.toThrow('Service temporarily unavailable');
    });

    it('should truncate plain text to 300 characters', async () => {
      const longText = 'A'.repeat(500);
      const errorResponse = new Response(longText, {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/plain' },
      });
      fetchMock.mockResolvedValueOnce(errorResponse);

      try {
        await http.get('/data');
        expect.fail('Should have thrown');
      } catch (error: any) {
        // Should be truncated to 300 chars (no requestId appended for long messages)
        expect(error.message.length).toBeLessThanOrEqual(350); // 300 + some buffer for requestId
      }
    });
  });

  describe('HTML error bodies', () => {
    it('should return safe summary for HTML error responses', async () => {
      const htmlResponse = new Response(
        '<!DOCTYPE html><html><body><h1>500 Internal Server Error</h1></body></html>',
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/html' },
        }
      );
      fetchMock.mockResolvedValueOnce(htmlResponse);

      await expect(http.get('/page')).rejects.toThrow(
        'Server returned an HTML error response'
      );
    });

    it('should detect HTML by <!DOCTYPE prefix', async () => {
      const htmlResponse = new Response('<!DOCTYPE html><html>Error</html>', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }, // Wrong content-type
      });
      fetchMock.mockResolvedValueOnce(htmlResponse);

      await expect(http.get('/page')).rejects.toThrow(
        'Server returned an HTML error response'
      );
    });

    it('should detect HTML by <html prefix', async () => {
      const htmlResponse = new Response('<html><body>Error</body></html>', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
      fetchMock.mockResolvedValueOnce(htmlResponse);

      await expect(http.get('/page')).rejects.toThrow(
        'Server returned an HTML error response'
      );
    });
  });

  describe('Malformed JSON fallback', () => {
    it('should treat malformed JSON as plain text', async () => {
      const malformedJson = '{ "message": "incomplete';
      const errorResponse = new Response(malformedJson, {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      });
      fetchMock.mockResolvedValueOnce(errorResponse);

      await expect(http.get('/data')).rejects.toThrow('{ "message": "incomplete');
    });

    it('should handle empty JSON object', async () => {
      const errorResponse = new Response('{}', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      });
      fetchMock.mockResolvedValueOnce(errorResponse);

      // Should fall back to default message
      await expect(http.get('/data')).rejects.toThrow('Request failed (500)');
    });
  });

  describe('Empty error bodies', () => {
    it('should use fallback message for empty body', async () => {
      const errorResponse = new Response('', {
        status: 500,
        statusText: 'Internal Server Error',
      });
      fetchMock.mockResolvedValueOnce(errorResponse);

      await expect(http.get('/data')).rejects.toThrow('Request failed (500)');
    });

    it('should use fallback message for whitespace-only body', async () => {
      const errorResponse = new Response('   \n\n  ', {
        status: 500,
        statusText: 'Internal Server Error',
      });
      fetchMock.mockResolvedValueOnce(errorResponse);

      await expect(http.get('/data')).rejects.toThrow('Request failed (500)');
    });
  });

  describe('Long body truncation', () => {
    it('should truncate very long plain text to 300 characters', async () => {
      const veryLongText = 'Error: '.repeat(100);
      const errorResponse = new Response(veryLongText, {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/plain' },
      });
      fetchMock.mockResolvedValueOnce(errorResponse);

      try {
        await http.get('/data');
        expect.fail('Should have thrown');
      } catch (error: any) {
        // Extract the base message (before requestId)
        const baseMessage = error.message.split(' [request ')[0];
        expect(baseMessage.length).toBeLessThanOrEqual(300);
      }
    });
  });

  describe('Successful responses', () => {
    it('should parse JSON response correctly', async () => {
      const successResponse = new Response(
        JSON.stringify({ id: 1, name: 'Test User' }),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchMock.mockResolvedValueOnce(successResponse);

      const result = await http.get('/users/1');
      expect(result).toEqual({ id: 1, name: 'Test User' });
    });

    it('should return undefined for 204 No Content', async () => {
      const noContentResponse = new Response(null, {
        status: 204,
        statusText: 'No Content',
      });
      fetchMock.mockResolvedValueOnce(noContentResponse);

      const result = await http.delete('/users/1');
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty response body', async () => {
      const emptyResponse = new Response('', {
        status: 200,
        statusText: 'OK',
      });
      fetchMock.mockResolvedValueOnce(emptyResponse);

      const result = await http.get('/data');
      expect(result).toBeUndefined();
    });
  });

  describe('shouldExposeRequestId logic', () => {
    it('should NOT append requestId for /auth/login with 401', async () => {
      const errorResponse = new Response(
        JSON.stringify({ message: 'Invalid credentials', requestId: 'req-123' }),
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchMock.mockResolvedValueOnce(errorResponse);

      try {
        await http.post('/auth/login', {});
        expect.fail('Should have thrown');
      } catch (error: any) {
        // Should NOT have [request ...] appended
        expect(error.message).toBe('Invalid credentials');
        expect(error.message).not.toContain('[request');
      }
    });

    it('should NOT append requestId when message contains "invalid"', async () => {
      const errorResponse = new Response(
        JSON.stringify({ message: 'Invalid input data', requestId: 'req-456' }),
        {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchMock.mockResolvedValueOnce(errorResponse);

      try {
        await http.post('/users', {});
        expect.fail('Should have thrown');
      } catch (error: any) {
        // Should NOT have [request ...] appended
        expect(error.message).toBe('Invalid input data');
        expect(error.message).not.toContain('[request');
      }
    });

    it('should append requestId for other errors', async () => {
      const errorResponse = new Response(
        JSON.stringify({ message: 'Database connection failed', requestId: 'req-789' }),
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      fetchMock.mockResolvedValueOnce(errorResponse);

      try {
        await http.get('/data');
        expect.fail('Should have thrown');
      } catch (error: any) {
        // Should have [request ...] appended
        expect(error.message).toBe('Database connection failed [request req-789]');
      }
    });
  });

  describe('Network errors', () => {
    it('should throw backend unavailable error when fetch fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(http.get('/health')).rejects.toThrow('Unable to reach the backend');
    });
  });
});
