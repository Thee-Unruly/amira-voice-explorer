// Configuration - Store API keys in environment variables for security
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
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
  source?: string;
}

// Utility to check if DeepSeek response lacks current information
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
    lowerContent.length < 150 // Short responses may indicate lack of info
  );
};

// Fetch content using OpenRouter DeepSeek R1 with enhanced prompting
const fetchDeepSeekResults = async (query: string): Promise<SearchResult> => {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { content: 'Please provide a search query.' };
    }

    if (!OPENROUTER_API_KEY) {
      return { content: 'OpenRouter API key is missing. Please configure it in environment variables.' };
    }

    // Enhanced prompt to encourage more comprehensive responses
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
        model: 'deepseek/deepseek-r1:free',
        messages: [
          {
            role: 'user',
            content: enhancedPrompt,
          },
        ],
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

// Fetch news-focused content using DeepSeek with news-specific prompting
const fetchNewsResults = async (query: string): Promise<SearchResult> => {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { content: 'Please provide a search query.' };
    }

    if (!OPENROUTER_API_KEY) {
      return { content: 'OpenRouter API key is missing. Please configure it in environment variables.' };
    }

    // News-specific prompt
    const newsPrompt = `Provide recent news and information about: "${cleanQuery}". 
    Focus on current events, recent developments, and newsworthy information. 
    If you have knowledge about recent events related to this topic, please share them.
    Include specific details, dates when possible, and context.
    Make your response informative and news-focused, at least 250 words.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: [
          {
            role: 'user',
            content: newsPrompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    console.log('News-focused DeepSeek API Response Status:', response.status);

    const data: OpenRouterResponse = await response.json();

    if (!response.ok || !data.choices || data.choices.length === 0) {
      return { content: `No recent news found for "${cleanQuery}". The topic may not have recent coverage or try using different keywords.` };
    }

    console.log(`Found news-focused response for "${cleanQuery}"`);
    return { content: data.choices[0].message.content, source: 'DeepSeek News' };
  } catch (error) {
    console.error('News-focused DeepSeek search failed:', error);
    return await fetchDeepSeekResults(query); // Fall back to basic search
  }
};

// New function to summarize content using DeepSeek
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
        messages: [
          {
            role: 'user',
            content: summaryPrompt,
          },
        ],
        max_tokens: 500, // Enough tokens for a summary of 120 words
        temperature: 0.7,
      }),
    });

    console.log('DeepSeek Summarization API Response Status:', response.status);

    const data: OpenRouterResponse = await response.json();

    if (!response.ok || !data.choices || data.choices.length === 0 || !data.choices[0].message.content) {
      console.error('Summarization failed:', data);
      return content.slice(0, maxLength) + '...'; // Fallback to truncation if summarization fails
    }

    console.log('Successfully summarized content with DeepSeek');
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('DeepSeek summarization failed:', error);
    return content.slice(0, maxLength) + '...'; // Fallback to truncation
  }
};

// Main function to search and summarize
export const searchAndSummarize = async (query: string): Promise<string> => {
  try {
    console.log('Starting search for:', query);
    
    // First try the enhanced DeepSeek search
    let result = await fetchDeepSeekResults(query);

    // If the response seems insufficient, try news-focused search
    if (isOutdatedResponse(result.content)) {
      console.log('Standard response insufficient, trying news-focused search');
      result = await fetchNewsResults(query);
    }

    // If still insufficient, return the content as-is
    if (result.content.length < 150 || result.content.includes('No results found') || result.content.includes('No recent news found')) {
      return result.content;
    }

    // Summarize the content using DeepSeek
    const truncatedContent = result.content.slice(0, 1500); // Truncate to avoid overwhelming the API
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

// Detailed search and summarize
export const searchAndSummarizeDetailed = async (query: string): Promise<string> => {
  try {
    console.log('Starting detailed search for:', query);
    
    // Try news-focused search first for detailed queries
    let result = await fetchNewsResults(query);

    // If insufficient, fall back to enhanced search
    if (isOutdatedResponse(result.content)) {
      console.log('News search insufficient, falling back to enhanced search');
      result = await fetchDeepSeekResults(query);
    }

    if (result.content.length < 200) {
      return result.content;
    }

    // Summarize the content using DeepSeek with a longer summary
    const truncatedContent = result.content.slice(0, 2000);
    const summary = await summarizeWithDeepSeek(truncatedContent, 180, 60);

    let finalText = summary;

    if (result.source) {
      finalText += `\n\nSource: ${result.source}`;
    }

    return finalText;
  } catch (error) {
    console.error('Error in detailed searchAndSummarize:', error);
    return "I'm sorry, I couldn't find or process information for that query. Would you like to try asking something else?";
  }
};

// Debug function to test API configurations
export const testApiConfiguration = async (): Promise<string> => {
  try {
    const openRouterResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: [{ role: 'user', content: 'Test query - please respond with a brief acknowledgment.' }],
        max_tokens: 50,
      }),
    });

    const openRouterData: OpenRouterResponse = await openRouterResponse.json();

    const results = [];

    if (openRouterResponse.ok && openRouterData.choices && openRouterData.choices.length > 0) {
      results.push('✅ OpenRouter API configuration is working correctly!');
      // Test summarization by sending a short text to summarize
      const testText = "This is a test text for summarization. It contains multiple sentences to ensure the summarization works properly. Let's see if DeepSeek can summarize this effectively.";
      const summary = await summarizeWithDeepSeek(testText, 30, 10);
      if (!summary.includes('...')) {
        results.push('✅ DeepSeek Summarization is working correctly!');
      } else {
        results.push('⚠️ DeepSeek Summarization failed, used fallback truncation.');
      }
    } else if (openRouterData.error) {
      results.push(`❌ OpenRouter API Error: ${openRouterData.error.message} (Code: ${openRouterData.error.code || 'Unknown'})`);
    } else {
      results.push(`⚠️ OpenRouter API responded but no results found. Status: ${openRouterResponse.status}`);
    }

    return results.join('\n');
  } catch (error) {
    return `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

// Quick search without summarization
export const quickSearch = async (query: string): Promise<string> => {
  try {
    console.log('Starting quick search for:', query);
    const result = await fetchDeepSeekResults(query);
    
    if (isOutdatedResponse(result.content)) {
      console.log('Quick search response insufficient, trying news-focused search');
      return (await fetchNewsResults(query)).content;
    }
    
    return result.content;
  } catch (error) {
    console.error('Error in quickSearch:', error);
    return 'Search failed. Please try again.';
  }
};