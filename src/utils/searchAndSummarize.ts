
import { pipeline } from '@huggingface/transformers';

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

// Function to scrape web content for a given query
const fetchSearchResults = async (query: string): Promise<string> => {
  try {
    // Create a URL for Wikipeda search
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(query)}`;

    // Make the request with proper headers
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'AMIRA/1.0 (educational project)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract content from response
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    // Handle page not found
    if (pageId === '-1') {
      console.log('No Wikipedia article found for query:', query);
      
      // Fall back to a web search API
      return await fallbackSearch(query);
    }
    
    // Extract the content from Wikipedia response
    const content = pages[pageId].extract;
    
    return content || 'No information found';
  } catch (error) {
    console.error('Error fetching search results:', error);
    return await fallbackSearch(query);
  }
};

// Fallback search function when Wikipedia doesn't have results
const fallbackSearch = async (query: string): Promise<string> => {
  try {
    // Using the DuckDuckGo API through a proxy (for demonstration)
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
    
    // This is just a demonstration. In a real app, you would use a proper API or service
    // For now, return a generic response to simulate a search
    return `I found some information about ${query}, but it needs more research to provide a complete answer.`;
  } catch (error) {
    console.error('Fallback search failed:', error);
    return "I couldn't find specific information on that topic.";
  }
};

// Main function to search and summarize
export const searchAndSummarize = async (query: string): Promise<string> => {
  try {
    // Fetch content related to the query
    const content = await fetchSearchResults(query);
    
    // If the content is too short, return it directly
    if (content.length < 200) {
      return content;
    }
    
    // Initialize the summarizer
    await initSummarizer();
    
    // Truncate content if it's too long for the model
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
