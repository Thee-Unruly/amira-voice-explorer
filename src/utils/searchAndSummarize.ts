import { pipeline, SummarizationOutput } from '@huggingface/transformers';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configuration - Store API keys in environment variables for security
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const NEWS_API_URL = 'https://newsapi.org/v2/everything';

// Interface for OpenRouter API response
interface OpenRouterResponse {
  choices?: Array<{
    message: { content: string };
  }>;
  error?: { message: string; code?: number };
}

// Interface for NewsAPI response
interface NewsApiResponse {
  status: string;
  articles?: Array<{
    title: string;
    description: string | null;
    content: string | null;
    url: string;
    source: { name: string };
  }>;
  error?: { message: string; code: number };
}

// Interface for search results
interface SearchResult {
  content: string;
  source?: string;
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

// Utility to check if DeepSeek response lacks current information
const isOutdatedResponse = (content: string): boolean => {
  const lowerContent = content.toLowerCase();
  return (
    lowerContent.includes('no recent information') ||
    lowerContent.includes('outdated') ||
    lowerContent.includes('no results found') ||
    lowerContent.includes("i don't have access to real-time") ||
    lowerContent.includes('try using different keywords') ||
    lowerContent.length < 200 // Short responses may indicate lack of info
  );
};

// Utility to simplify query for NewsAPI (e.g., remove question phrasing)
const simplifyQueryForNewsApi = (query: string): string => {
  return query
    .replace(/^(what are the recent news about|latest news on|news about)\s+/i, '')
    .trim();
};

// Fetch content using OpenRouter DeepSeek R1
const fetchDeepSeekResults = async (query: string): Promise<SearchResult> => {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { content: 'Please provide a search query.' };
    }

    if (!OPENROUTER_API_KEY) {
      return { content: 'OpenRouter API key is missing. Please configure it in environment variables.' };
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/r1', // Consistent model name
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

    console.log('OpenRouter API Response Status:', response.status);

    const data: OpenRouterResponse = await response.json();

    if (!response.ok) {
      console.error('API Error Response:', data);
      if (data.error) {
        const errorMessage = data.error.message || 'Unknown API error';
        const errorCode = data.error.code || response.status;
        switch (errorCode) {
          case 400:
            return { content: `Query error: ${errorMessage}. Please try a different search term.` };
          case 403:
            return { content: 'API key invalid or access denied. Please check your OpenRouter API key.' };
          case 429:
            return { content: 'Too many requests. Please wait a moment and try again.' };
          default:
            return { content: `OpenRouter API error (${errorCode}): ${errorMessage}` };
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!data.choices || data.choices.length === 0 || !data.choices[0].message.content) {
      return { content: `No results found for "${cleanQuery}". Try using different keywords.` };
    }

    console.log(`Received DeepSeek response for "${cleanQuery}"`);
    return { content: data.choices[0].message.content };
  } catch (error) {
    console.error('OpenRouter API failed:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { content: 'Network error. Please check your internet connection and try again.' };
    }
    return { content: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.` };
  }
};

// Fetch real-time news using NewsAPI
const fetchNewsApiResults = async (query: string): Promise<SearchResult> => {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { content: 'Please provide a search query.' };
    }

    if (!NEWS_API_KEY) {
      return { content: 'NewsAPI key is missing. Please configure it in environment variables.' };
    }

    // Simplify query for better NewsAPI results
    const simplifiedQuery = simplifyQueryForNewsApi(cleanQuery);
    const newsUrl = `${NEWS_API_URL}?q=${encodeURIComponent(simplifiedQuery)}&apiKey=${NEWS_API_KEY}&sortBy=publishedAt&pageSize=5`;

    console.log('NewsAPI URL:', newsUrl);
    console.log('Searching NewsAPI for:', simplifiedQuery);

    const response = await fetch(newsUrl);
    const data: NewsApiResponse = await response.json();

    console.log('NewsAPI Response:', data);

    if (data.status !== 'ok' || !data.articles || data.articles.length === 0) {
      return { content: `No recent news found for "${simplifiedQuery}". Try using different keywords.` };
    }

    console.log(`Found ${data.articles.length} news articles`);

    const combinedContent = data.articles
      .map((article, index) => {
        const title = article.title || '';
        const description = article.description || '';
        const content = article.content || '';
        const source = article.source.name || 'Unknown source';
        return `Source ${index + 1} (${source}): ${title}\n${description}\n${content}`;
      })
      .join('\n\n');

    return { content: combinedContent, source: 'NewsAPI' };
  } catch (error) {
    console.error('NewsAPI failed:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { content: 'Network error. Please check your internet connection and try again.' };
    }
    return { content: `NewsAPI search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.` };
  }
};

// Main function to search and summarize
export const searchAndSummarize = async (query: string): Promise<string> => {
  try {
    let result = await fetchDeepSeekResults(query);

    if (isOutdatedResponse(result.content)) {
      console.log('DeepSeek response outdated or insufficient, falling back to NewsAPI');
      result = await fetchNewsApiResults(query);
    }

    if (result.content.length < 200 || result.content.includes('No results found') || result.content.includes('No recent news found')) {
      return result.content;
    }

    await initSummarizer();

    const truncatedContent = result.content.slice(0, 1000);

    const summary: SummarizationOutput = await summarizer(truncatedContent, {
      max_length: 100,
      min_length: 30,
      do_sample: false,
    });

    let summaryText = summary[0].summary_text;
    if (result.source === 'NewsAPI') {
      summaryText += `\n\nSource: NewsAPI`;
    }

    return summaryText;
  } catch (error) {
    console.error('Error in searchAndSummarize:', error);
    return "I'm sorry, I couldn't find or process information for that query. Would you like to try asking something else?";
  }
};

// Fetch detailed results using DeepSeek R1
const fetchDetailedDeepSeekResults = async (query: string): Promise<SearchResult> => {
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/r1', // Consistent model name
        messages: [
          {
            role: 'user',
            content: `Provide a detailed response to the query "${query}" with structured information. If the query involves current information, provide the most up-to-date information you have access to.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    const data: OpenRouterResponse = await response.json();

    if (!response.ok || !data.choices || data.choices.length === 0) {
      return { content: `No detailed results found for "${query}".` };
    }

    return { content: data.choices[0].message.content };
  } catch (error) {
    console.error('Detailed DeepSeek search failed:', error);
    return await fetchDeepSeekResults(query); // Fall back to basic DeepSeek search
  }
};

// Detailed search and summarize
export const searchAndSummarizeDetailed = async (query: string): Promise<string> => {
  try {
    let result = await fetchDetailedDeepSeekResults(query);

    if (isOutdatedResponse(result.content)) {
      console.log('DeepSeek detailed response outdated or insufficient, falling back to NewsAPI');
      result = await fetchNewsApiResults(query);
    }

    if (result.content.length < 200 || result.content.includes('No results found') || result.content.includes('No recent news found')) {
      return result.content;
    }

    await initSummarizer();

    const truncatedContent = result.content.slice(0, 1500);

    const summary: SummarizationOutput = await summarizer(truncatedContent, {
      max_length: 150,
      min_length: 50,
      do_sample: false,
    });

    let summaryText = summary[0].summary_text;
    if (result.source === 'NewsAPI') {
      summaryText += `\n\nSource: NewsAPI`;
    }

    return summaryText;
  } catch (error) {
    console.error('Error in detailed searchAndSummarize:', error);
    return "I'm sorry, I couldn't find or process information for that query. Would you like to try asking something else?";
  }
};

// Debug function to test API configurations
export const testApiConfiguration = async (): Promise<string> => {
  try {
    const testQuery = 'test';
    const openRouterResponse = await fetch(OPENROUTER_API_URL, {
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

    const openRouterData: OpenRouterResponse = await openRouterResponse.json();

    const newsUrl = `${NEWS_API_URL}?q=test&apiKey=${NEWS_API_KEY}&pageSize=1`;
    const newsResponse = await fetch(newsUrl);
    const newsData: NewsApiResponse = await newsResponse.json();

    const results = [];

    if (openRouterResponse.ok && openRouterData.choices && openRouterData.choices.length > 0) {
      results.push('✅ OpenRouter API configuration is working correctly!');
    } else if (openRouterData.error) {
      results.push(`❌ OpenRouter API Error: ${openRouterData.error.message} (Code: ${openRouterData.error.code || 'Unknown'})`);
    } else {
      results.push(`⚠️ OpenRouter API responded but no results found. Status: ${openRouterResponse.status}`);
    }

    if (newsResponse.ok && newsData.status === 'ok' && newsData.articles && newsData.articles.length > 0) {
      results.push('✅ NewsAPI configuration is working correctly!');
    } else if (newsData.error) {
      results.push(`❌ NewsAPI Error: ${newsData.error.message} (Code: ${newsData.error.code || 'Unknown'})`);
    } else {
      results.push(`⚠️ NewsAPI responded but no results found. Status: ${newsResponse.status}`);
    }

    return results.join('\n');
  } catch (error) {
    return `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

// Quick search without summarization
export const quickSearch = async (query: string): Promise<string> => {
  try {
    const result = await fetchDeepSeekResults(query);
    if (isOutdatedResponse(result.content)) {
      console.log('DeepSeek quick search response outdated, falling back to NewsAPI');
      return (await fetchNewsApiResults(query)).content;
    }
    return result.content;
  } catch (error) {
    console.error('Error in quickSearch:', error);
    return 'Search failed. Please try again.';
  }
};