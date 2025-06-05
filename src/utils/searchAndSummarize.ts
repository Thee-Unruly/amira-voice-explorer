import { pipeline } from '@huggingface/transformers';

// Configuration - Replace with your actual Search Engine ID
const GOOGLE_API_KEY = 'AIzaSyBPPPeDIsLyOHWSWQQfnH1-hNqDZuV69E';
const SEARCH_ENGINE_ID = '81e9b1268d8644286';

// Setup for summarizer pipeline
let summarizer: any = null;

// Initialize the summarizer
const initSummarizer = async () => {
  if (!summarizer) {
    try {
      summarizer = await pipeline('summarization', 'facebook/bart-large-cnn');
    } catch (error) {
      console.error('Failed to load summarizer model:', error);
      throw new Error('Failed to initialize AI model');
    }
  }
  return summarizer;
};

// Main search function using Google Custom Search API
const fetchSearchResults = async (query: string): Promise<string> => {
  try {
    // Google Custom Search API endpoint
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`;
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`Google Search API error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if we have search results
    if (!data.items || data.items.length === 0) {
      return `No search results found for "${query}".`;
    }
    
    // Combine content from multiple results for better context
    const combinedContent = data.items
      .slice(0, 5) // Use top 5 results
      .map((item: any, index: number) => {
        const title = item.title || '';
        const snippet = item.snippet || '';
        // Include more context by combining title and snippet
        return `${title}: ${snippet}`;
      })
      .join(' '); // Join with space for better flow
    
    return combinedContent || `Found results for "${query}" but no detailed content available.`;
    
  } catch (error) {
    console.error('Google Search API failed:', error);
    
    // Handle specific API errors
    if (error instanceof Error && error.message.includes('403')) {
      return "Search quota exceeded. Please try again later.";
    } else if (error instanceof Error && error.message.includes('400')) {
      return "Invalid search query. Please try rephrasing your question.";
    }
    
    return `I couldn't search for information about "${query}". This might be due to API limitations or network issues.`;
  }
};

// Alternative function that gets more detailed content per result
const fetchDetailedSearchResults = async (query: string): Promise<string> => {
  try {
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=3`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return `No search results found for "${query}".`;
    }
    
    // Format results with more structure
    const formattedResults = data.items
      .slice(0, 3)
      .map((item: any, index: number) => {
        const title = item.title || '';
        const snippet = item.snippet || '';
        const source = item.displayLink || '';
        
        return `Source ${index + 1} (${source}): ${title}\n${snippet}`;
      })
      .join('\n\n');
    
    return formattedResults;
    
  } catch (error) {
    console.error('Detailed search failed:', error);
    return await fetchSearchResults(query); // Fall back to basic search
  }
};

// Main function to search and summarize
export const searchAndSummarize = async (query: string): Promise<string> => {
  try {
    // Fetch content related to the query using Google Search
    const content = await fetchSearchResults(query);
    
    // If the content is too short or indicates no results, return it directly
    if (content.length < 200 || content.includes('No search results found')) {
      return content;
    }
    
    // Initialize the summarizer
    await initSummarizer();
    
    // Truncate content if it's too long for the model (BART has token limits)
    const truncatedContent = content.slice(0, 1000);
    
    // Summarize the content
    const result = await summarizer(truncatedContent, {
      max_length: 100,
      min_length: 30,
      do_sample: false
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
    // Get more detailed search results
    const content = await fetchDetailedSearchResults(query);
    
    if (content.length < 200 || content.includes('No search results found')) {
      return content;
    }
    
    await initSummarizer();
    
    // Allow more content for detailed version
    const truncatedContent = content.slice(0, 1500);
    
    const result = await summarizer(truncatedContent, {
      max_length: 150, // Longer summary for detailed version
      min_length: 50,
      do_sample: false
    });
    
    return result[0].summary_text;
  } catch (error) {
    console.error('Error in detailed searchAndSummarize:', error);
    return "I'm sorry, I couldn't find or process information for that query. Would you like to try asking something else?";
  }
};

// Quick search function that returns raw results without summarization
export const quickSearch = async (query: string): Promise<string> => {
  try {
    return await fetchSearchResults(query);
  } catch (error) {
    console.error('Error in quickSearch:', error);
    return "Search failed. Please try again.";
  }
};