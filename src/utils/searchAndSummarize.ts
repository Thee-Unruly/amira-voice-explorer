// Configuration - Store API keys in environment variables for security
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FIRECRAWL_API_KEY = import.meta.env.VITE_FIRECRAWL_API_KEY || '';
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/search';

// Interface for OpenRouter API response
interface OpenRouterResponse {
  choices?: Array<{
    message: { content: string };
  }>;
  error?: { message: string; code?: number };
}

// Interface for Firecrawl API response
interface FirecrawlResponse {
  success: boolean;
  data?: Array<{ content: string; url: string }>;
  error?: string;
}

// Interface for search results
interface SearchResult {
  content: string;
  source?: string;
}

// Utility to check if response lacks current information
const isOutdatedResponse = (content: string): boolean => {
  const lowerContent = content.toLowerCase();
  return (
    lowerContent.includes('no recent information') ||
    lowerContent.includes('outdated') ||
    lowerContent.includes('no results found') ||
    lowerContent.includes("i don't have access to real-time") ||
    lowerContent.includes('try using different keywords') ||
    lowerContent.includes('my knowledge cutoff') ||
    lowerContent.includes('as of my last update') ||
    lowerContent.length < 150
  );
};

// Fetch content using OpenRouter DeepSeek
const fetchDeepSeekResults = async (query: string): Promise<SearchResult> => {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { content: 'Please provide a search query.' };
    }

    if (!OPENROUTER_API_KEY) {
      return { content: 'OpenRouter API key is missing. Please configure it in environment variables.' };
    }

    const enhancedPrompt = `Please provide a detailed and informative response about: "${cleanQuery}". 
    Include relevant facts, recent developments if known, and context. 
    If this involves current events or recent news, provide the most up-to-date information available to you.
    Make your response comprehensive and informative, at least 200 words.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat:free',
        messages: [{ role: 'user', content: enhancedPrompt }],
        max_tokens: 1500,
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
      console.log('No results from DeepSeek, falling back to Firecrawl');
      return await fetchFirecrawlResults(query);
    }

    const content = data.choices[0].message.content;
    if (isOutdatedResponse(content)) {
      console.log('DeepSeek response outdated, falling back to Firecrawl');
      return await fetchFirecrawlResults(query);
    }

    console.log(`Received DeepSeek response for "${cleanQuery}"`);
    return { content, source: 'DeepSeek' };
  } catch (error) {
    console.error('OpenRouter API failed:', error);
    return await fetchFirecrawlResults(query); // Fall back to Firecrawl
  }
};

// Fetch content using Firecrawl Search API
const fetchFirecrawlResults = async (query: string): Promise<SearchResult> => {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { content: 'Please provide a search query.' };
    }

    if (!FIRECRAWL_API_KEY) {
      return { content: 'Firecrawl API key is missing. Please configure it in environment variables.' };
    }

    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query: cleanQuery,
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    console.log('Firecrawl API Response Status:', response.status);

    const data: FirecrawlResponse = await response.json();

    if (!response.ok || !data.success || !data.data || data.data.length === 0) {
      return { content: `No results found for "${cleanQuery}" using Firecrawl. Try different keywords.`, source: 'Firecrawl' };
    }

    // Combine content from top results
    const combinedContent = data.data
      .slice(0, 3)
      .map((item) => `Source: ${item.url}\n${item.content}`)
      .join('\n\n');

    console.log(`Received Firecrawl response for "${cleanQuery}"`);
    return { content: combinedContent, source: 'Firecrawl' };
  } catch (error) {
    console.error('Firecrawl API failed:', error);
    return { content: `Firecrawl search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`, source: 'Firecrawl' };
  }
};

// Summarize content using DeepSeek
const summarizeWithDeepSeek = async (content: string, maxLength: number = 120, minLength: number = 40): Promise<string> => {
  try {
    if (!OPENROUTER_API_KEY) {
      return 'OpenRouter API key is missing. Please configure it in environment variables.';
    }

    const summaryPrompt = `Please summarize the following text into a concise paragraph of ${minLength} to ${maxLength} words. Focus on the key points, main ideas, and critical information. Avoid adding extra details or opinions not present in the text. Here is the text to summarize: "${content}"`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: [{ role: 'user', content: summaryPrompt }],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    console.log('DeepSeek Summarization API Response Status:', response.status);

    const data: OpenRouterResponse = await response.json();

    if (!response.ok || !data.choices || data.choices.length === 0 || !data.choices[0].message.content) {
      console.error('Summarization failed:', data);
      return content.slice(0, maxLength) + '...';
    }

    console.log('Successfully summarized content with DeepSeek');
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('DeepSeek summarization failed:', error);
    return content.slice(0, maxLength) + '...';
  }
};

// Main search and summarize function
export const searchAndSummarize = async (query: string): Promise<string> => {
  try {
    console.log('Starting search for:', query);

    // Fetch results (DeepSeek with Firecrawl fallback)
    let result = await fetchDeepSeekResults(query);

    // If no useful results, return as-is
    if (result.content.length < 150 || result.content.includes('No results found')) {
      return result.content;
    }

    // Summarize the content using DeepSeek
    const truncatedContent = result.content.slice(0, 1500);
    const summary = await summarizeWithDeepSeek(truncatedContent, 120, 40);

    let finalText = summary;
    if (result.source) {
      finalText += `\n\nSource: ${result.source}`;
    }

    return finalText;
  } catch (error) {
    console.error('Error in searchAndSummarize:', error);
    return "I'm sorry, I couldn't find or process information for that query. Would you like to try asking something else?";
  }
};

// Test API configuration
export const testApiConfiguration = async (): Promise<string> => {
  const results = [];

  // Test OpenRouter API
  try {
    const openRouterResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: [{ role: 'user', content: 'Test query' }],
        max_tokens: 50,
      }),
    });
    const openRouterData: OpenRouterResponse = await openRouterResponse.json();
    if (openRouterResponse.ok && openRouterData.choices?.length) {
      results.push('✅ OpenRouter API configuration is working correctly!');
      const testText = "This is a test text for summarization.";
      const summary = await summarizeWithDeepSeek(testText, 30, 10);
      results.push(summary.includes('...') ? '⚠️ DeepSeek Summarization failed' : '✅ DeepSeek Summarization is working correctly!');
    } else {
      results.push(`❌ OpenRouter API Error: ${openRouterData.error?.message || 'Unknown'}`);
    }
  } catch (error) {
    results.push(`❌ OpenRouter Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Test Firecrawl API
  try {
    const firecrawlResponse = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query: 'test query',
        scrapeOptions: { formats: ['markdown'] },
      }),
    });
    const firecrawlData: FirecrawlResponse = await firecrawlResponse.json();
    if (firecrawlResponse.ok && firecrawlData.success && firecrawlData.data?.length) {
      results.push('✅ Firecrawl API configuration is working correctly!');
    } else {
      results.push(`❌ Firecrawl API Error: ${firecrawlData.error || 'Unknown'}`);
    }
  } catch (error) {
    results.push(`❌ Firecrawl Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return results.join('\n');
};