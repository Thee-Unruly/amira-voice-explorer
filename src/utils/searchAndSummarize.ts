// Configuration - Store API keys in environment variables for security
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FIRECRAWL_API_KEY = import.meta.env.VITE_FIRECRAWL_API_KEY || 'fc-c130afde18b24000aba32a56288c42be'; // Temporary - move to .env file
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
  data?: Array<{ 
    content: string; 
    url: string; 
    title?: string;
    description?: string;
  }>;
  error?: string;
}

// Interface for search results
interface SearchResult {
  content: string;
  source?: string;
  urls?: string[];
  isRealTime?: boolean;
}

// Enhanced utility to detect queries that need real-time information
const needsRealTimeInfo = (query: string): boolean => {
  const lowerQuery = query.toLowerCase();
  const realTimeKeywords = [
    'today', 'now', 'current', 'latest', 'recent', 'breaking', 'news',
    'stock price', 'weather', 'live', 'happening', 'trending', 'update',
    '2024', '2025', 'this week', 'this month', 'this year'
  ];
  
  return realTimeKeywords.some(keyword => lowerQuery.includes(keyword));
};

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
    lowerContent.length < 100
  );
};

// Enhanced Firecrawl search with better result processing
const fetchFirecrawlResults = async (query: string): Promise<SearchResult> => {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { content: 'Please provide a search query.' };
    }

    if (!FIRECRAWL_API_KEY) {
      return { content: 'Firecrawl API key is missing. Please configure it in environment variables.' };
    }

    console.log('Searching with Firecrawl for real-time data:', cleanQuery);

    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query: cleanQuery,
        pageOptions: {
          onlyMainContent: true
        },
        scrapeOptions: { 
          formats: ['markdown', 'html'],
          onlyMainContent: true,
          excludeTags: ['nav', 'footer', 'aside', 'script', 'style']
        },
        limit: 5 // Get more results for better coverage
      }),
    });

    console.log('Firecrawl API Response Status:', response.status);

    const data: FirecrawlResponse = await response.json();

    if (!response.ok || !data.success || !data.data || data.data.length === 0) {
      console.log('No Firecrawl results found');
      return { 
        content: `No real-time results found for "${cleanQuery}". The information may not be available or the query might need refinement.`, 
        source: 'Firecrawl',
        isRealTime: true
      };
    }

    // Process and combine the best results
    const processedResults = data.data
      .filter(item => item.content && item.content.length > 50) // Filter out very short content
      .slice(0, 3) // Take top 3 results
      .map((item, index) => {
        const title = item.title ? `**${item.title}**\n` : '';
        const url = `Source: ${item.url}\n`;
        const content = item.content.slice(0, 800); // Limit each result length
        return `${index + 1}. ${title}${url}${content}`;
      });

    if (processedResults.length === 0) {
      return { 
        content: `No substantial content found for "${cleanQuery}". Try using more specific search terms.`, 
        source: 'Firecrawl',
        isRealTime: true
      };
    }

    const combinedContent = processedResults.join('\n\n---\n\n');
    const urls = data.data.map(item => item.url);

    console.log(`Successfully retrieved ${processedResults.length} real-time results from Firecrawl`);
    
    return { 
      content: combinedContent, 
      source: 'Firecrawl',
      urls: urls,
      isRealTime: true
    };

  } catch (error) {
    console.error('Firecrawl API failed:', error);
    return { 
      content: `Real-time search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again with different keywords.`, 
      source: 'Firecrawl',
      isRealTime: true
    };
  }
};

// Fallback DeepSeek search (for when Firecrawl fails or for general knowledge)
const fetchDeepSeekResults = async (query: string): Promise<SearchResult> => {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { content: 'Please provide a search query.' };
    }

    if (!OPENROUTER_API_KEY) {
      return { content: 'OpenRouter API key is missing. Please configure it in environment variables.' };
    }

    const enhancedPrompt = `Please provide a comprehensive and informative response about: "${cleanQuery}". 
    Include relevant facts, context, and any available information. 
    If this involves recent events, acknowledge any limitations in real-time data access.
    Make your response detailed and informative, at least 150 words.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat:free',
        messages: [{ role: 'user', content: enhancedPrompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    const data: OpenRouterResponse = await response.json();

    if (!response.ok || !data.choices || data.choices.length === 0 || !data.choices[0].message.content) {
      return { content: `No results available from DeepSeek for "${cleanQuery}".`, source: 'DeepSeek' };
    }

    const content = data.choices[0].message.content;
    console.log('Retrieved DeepSeek fallback response');
    return { content, source: 'DeepSeek', isRealTime: false };

  } catch (error) {
    console.error('DeepSeek search failed:', error);
    return { 
      content: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}.`, 
      source: 'DeepSeek',
      isRealTime: false
    };
  }
};

// Enhanced summarization with better prompts for real-time content
const summarizeWithDeepSeek = async (
  content: string, 
  isRealTime: boolean = false,
  maxLength: number = 150, 
  minLength: number = 50
): Promise<string> => {
  try {
    if (!OPENROUTER_API_KEY) {
      return 'OpenRouter API key is missing for summarization.';
    }

    const contentType = isRealTime ? 'real-time search results' : 'information';
    const summaryPrompt = `Please create a clear and concise summary of the following ${contentType}. 
    The summary should be between ${minLength} and ${maxLength} words.
    Focus on the most important facts, key points, and actionable information.
    ${isRealTime ? 'Pay special attention to dates, current status, and recent developments.' : ''}
    Maintain accuracy and avoid adding information not present in the original text.
    
    Content to summarize:
    ${content}`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: [{ role: 'user', content: summaryPrompt }],
        max_tokens: Math.ceil(maxLength * 1.5), // Allow some buffer for the response
        temperature: 0.3, // Lower temperature for more focused summaries
      }),
    });

    const data: OpenRouterResponse = await response.json();

    if (!response.ok || !data.choices || data.choices.length === 0 || !data.choices[0].message.content) {
      console.error('Summarization failed, using truncation');
      return content.slice(0, maxLength) + '...';
    }

    const summary = data.choices[0].message.content.trim();
    console.log('Successfully summarized content with DeepSeek');
    return summary;

  } catch (error) {
    console.error('DeepSeek summarization failed:', error);
    return content.slice(0, maxLength) + '...';
  }
};

// Main search function - prioritizes real-time data
export const searchAndSummarize = async (
  query: string, 
  forceRealTime: boolean = false
): Promise<string> => {
  try {
    console.log('Starting search for:', query);

    const requiresRealTime = forceRealTime || needsRealTimeInfo(query);
    
    let result: SearchResult;

    if (requiresRealTime) {
      console.log('Query requires real-time information - using Firecrawl');
      result = await fetchFirecrawlResults(query);
      
      // If Firecrawl fails completely, fall back to DeepSeek but inform user
      if (result.content.includes('Real-time search failed') || result.content.includes('No real-time results')) {
        console.log('Firecrawl failed, falling back to DeepSeek with disclaimer');
        const fallbackResult = await fetchDeepSeekResults(query);
        fallbackResult.content = `⚠️ Real-time search unavailable. Here's general information:\n\n${fallbackResult.content}`;
        result = fallbackResult;
      }
    } else {
      console.log('General query - trying DeepSeek first');
      result = await fetchDeepSeekResults(query);
      
      // If DeepSeek response seems insufficient, try Firecrawl for more current info
      if (isOutdatedResponse(result.content)) {
        console.log('DeepSeek response insufficient, trying Firecrawl for current information');
        const firecrawlResult = await fetchFirecrawlResults(query);
        if (!firecrawlResult.content.includes('No real-time results')) {
          result = firecrawlResult;
        }
      }
    }

    // If content is too short or indicates failure, return as-is
    if (result.content.length < 100 || 
        result.content.includes('No results') || 
        result.content.includes('failed')) {
      return result.content;
    }

    // Summarize the content
    const contentToSummarize = result.content.slice(0, 2000); // Limit input length
    const summary = await summarizeWithDeepSeek(
      contentToSummarize, 
      result.isRealTime || requiresRealTime,
      requiresRealTime ? 200 : 150, // Longer summaries for real-time queries
      requiresRealTime ? 80 : 50
    );

    // Format final response
    let finalResponse = summary;
    
    if (result.isRealTime) {
      finalResponse = `🔍 **Real-time Search Results:**\n\n${summary}`;
    }
    
    if (result.source) {
      finalResponse += `\n\n*Source: ${result.source}*`;
    }
    
    if (result.urls && result.urls.length > 0) {
      finalResponse += `\n\n*Key Sources:*\n${result.urls.slice(0, 3).map(url => `• ${url}`).join('\n')}`;
    }

    return finalResponse;

  } catch (error) {
    console.error('Error in searchAndSummarize:', error);
    return `I encountered an error while searching for information about "${query}". Please try again with different keywords or check your API configuration.`;
  }
};

// Specific function for real-time searches
export const searchRealTime = async (query: string): Promise<string> => {
  return searchAndSummarize(query, true);
};

// Test API configuration with enhanced checks
export const testApiConfiguration = async (): Promise<string> => {
  const results = [];

  // Test OpenRouter API (DeepSeek)
  console.log('Testing OpenRouter API...');
  try {
    const openRouterResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat:free',
        messages: [{ role: 'user', content: 'Hello, this is a test. Please respond briefly.' }],
        max_tokens: 50,
      }),
    });
    
    const openRouterData: OpenRouterResponse = await openRouterResponse.json();
    
    if (openRouterResponse.ok && openRouterData.choices?.length) {
      results.push('✅ OpenRouter API (DeepSeek) is working correctly!');
      
      // Test summarization capability
      const testSummary = await summarizeWithDeepSeek(
        "This is a longer test text that should be summarized into a shorter version while maintaining the key information and meaning.", 
        false, 30, 10
      );
      
      if (testSummary.length > 0 && !testSummary.includes('...')) {
        results.push('✅ DeepSeek Summarization is working correctly!');
      } else {
        results.push('⚠️ DeepSeek Summarization may have issues');
      }
    } else {
      results.push(`❌ OpenRouter API Error: ${openRouterData.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    results.push(`❌ OpenRouter Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Test Firecrawl API
  console.log('Testing Firecrawl API...');
  try {
    const firecrawlResponse = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query: 'latest technology news',
        limit: 2,
        scrapeOptions: { formats: ['markdown'] },
      }),
    });
    
    const firecrawlData: FirecrawlResponse = await firecrawlResponse.json();
    
    if (firecrawlResponse.ok && firecrawlData.success && firecrawlData.data?.length) {
      results.push('✅ Firecrawl API is working correctly!');
      results.push(`   Retrieved ${firecrawlData.data.length} search results`);
    } else {
      results.push(`❌ Firecrawl API Error: ${firecrawlData.error || 'No results returned'}`);
    }
  } catch (error) {
    results.push(`❌ Firecrawl Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Test combined functionality
  console.log('Testing combined search and summarization...');
  try {
    const testResult = await searchRealTime('current weather');
    if (testResult.length > 50 && !testResult.includes('failed')) {
      results.push('✅ Combined real-time search and summarization working!');
    } else {
      results.push('⚠️ Combined functionality may have issues');
    }
  } catch (error) {
    results.push('⚠️ Combined functionality test failed');
  }

  return results.join('\n');
};