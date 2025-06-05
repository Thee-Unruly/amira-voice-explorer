import { pipeline, SummarizationOutput } from '@huggingface/transformers';

// Configuration - Store OpenRouter API key in environment variables for security
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Interface for OpenRouter API response
interface OpenRouterResponse {
  choices?: Array<{
    message: { content: string };
  }>;
  error?: { message: string; code?: number };
}

// Interface for search results
interface SearchResult {
  content: string;
}

// Summarizer instance
let summarizer: any = null;

// Initialize the summarizer with caching
const initSummarizer = async (): Promise<any> => {
  if (!summarizer) {
    try {
      summarizer = await pipeline('summarization', 'facebook/bart-large-cnn', {
        cacheDir: './model-cache',
      });
    } catch (error) {
      console.error('Failed to load summarizer model:', error);
      throw new Error('Failed to initialize AI model');
    }
  }
  return summarizer;
};

// Main function to fetch content using OpenRouter DeepSeek R1
const fetchDeepSeekResults = async (query: string): Promise<string> => {
  try {
    // Clean and validate the query
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return 'Please provide a search query.';
    }

    if (!OPENROUTER_API_KEY) {
      return 'OpenRouter API key is missing. Please configure it in environment variables.';
    }

    // OpenRouter API request
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/r1',
        messages: [
          {
            role: 'user',
            content: `Provide a detailed and concise response to the query: "${cleanQuery}"`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    console.log('OpenRouter API Response Status:', response.status); // Debug log

    const data: OpenRouterResponse = await response.json();

    if (!response.ok) {
      console.error('API Error Response:', data);
      if (data.error) {
        const errorMessage = data.error.message || 'Unknown API error';
        const errorCode = data.error.code || response.status;

        switch (errorCode) {
          case 400:
            return `Query error: ${errorMessage}. Please try a different search term.`;
          case 403:
            return 'API key invalid or access denied. Please check your OpenRouter API key.';
          case 429:
            return 'Too many requests. Please wait a moment and try again.';
          default:
            return `OpenRouter API error (${errorCode}): ${errorMessage}`;
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check if we have valid response content
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message.content) {
      return `No results found for "${cleanQuery}". Try using different keywords.`;
    }

    console.log(`Received response for "${cleanQuery}"`); // Debug log

    // Extract content from the response
    const content = data.choices[0].message.content;

    return content || `Found results for "${cleanQuery}" but no detailed content available.`;
  } catch (error) {
    console.error('OpenRouter API failed:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
  }
};

// Alternative function for detailed results
const fetchDetailedDeepSeekResults = async (query: string): Promise<string> => {
  try {
    // Use a more detailed prompt for richer output
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/r1',
        messages: [
          {
            role: 'user',
            content: `Provide a detailed response to the query "${query}" with structured information, If the query involves current information, provide the most up-to-date information you have access to.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    const data: OpenRouterResponse = await response.json();

    if (!response.ok || !data.choices || data.choices.length === 0) {
      return `No detailed results found for "${query}".`;
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Detailed DeepSeek search failed:', error);
    return await fetchDeepSeekResults(query); // Fall back to basic search
  }
};

// Main function to search and summarize
export const searchAndSummarize = async (query: string): Promise<string> => {
  try {
    // Fetch content using DeepSeek R1 via OpenRouter
    const content = await fetchDeepSeekResults(query);

    // If the content is too short or indicates no results, return it directly
    if (content.length < 200 || content.includes('No results found')) {
      return content;
    }

    // Initialize the summarizer
    await initSummarizer();

    // Truncate content if it's too long for the model (BART has token limits)
    const truncatedContent = content.slice(0, 1000);

    // Summarize the content
    const result: SummarizationOutput = await summarizer(truncatedContent, {
      max_length: 100,
      min_length: 30,
      do_sample: false,
    });

    return result[0].summary_text;
  } catch (error) {
    console.error('Error in searchAndSummarize:', error);
    return "I'm sorry, I couldn't find or process information for that query. Would you like to try asking something else?";
  }
};

// Export a version that provides more detailed, structured results
export const searchAndSummarizeDetailed = async (query: string): Promise<string> => {
  try {
    // Get more detailed results
    const content = await fetchDetailedDeepSeekResults(query);

    if (content.length < 200 || content.includes('No detailed results found')) {
      return content;
    }

    await initSummarizer();

    // Allow more content for detailed version
    const truncatedContent = content.slice(0, 1500);

    const result: SummarizationOutput = await summarizer(truncatedContent, {
      max_length: 150, // Longer summary for detailed version
      min_length: 50,
      do_sample: false,
    });

    return result[0].summary_text;
  } catch (error) {
    console.error('Error in detailed searchAndSummarize:', error);
    return "I'm sorry, I couldn't find or process information for that query. Would you like to try asking something else?";
  }
};

// Debug function to test OpenRouter API configuration
export const testApiConfiguration = async (): Promise<string> => {
  try {
    const testQuery = 'test';
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/r1',
        messages: [{ role: 'user', content: 'Test query' }],
        max_tokens: 100,
      }),
    });

    console.log('Testing OpenRouter API with query:', testQuery);

    const data: OpenRouterResponse = await response.json();

    if (response.ok && data.choices && data.choices.length > 0) {
      return '✅ OpenRouter API configuration is working correctly!';
    } else if (data.error) {
      return `❌ API Error: ${data.error.message} (Code: ${data.error.code || 'Unknown'})`;
    } else {
      return `⚠️ API responded but no results found. Status: ${response.status}`;
    }
  } catch (error) {
    return `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

// Quick search function that returns raw results without summarization
export const quickSearch = async (query: string): Promise<string> => {
  try {
    return await fetchDeepSeekResults(query);
  } catch (error) {
    console.error('Error in quickSearch:', error);
    return 'Search failed. Please try again.';
  }
};