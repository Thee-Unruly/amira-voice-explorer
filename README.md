# Search and Summarize with Firecrawl and DeepSeek

This project provides a TypeScript-based tool to search for real-time information using the Firecrawl API and summarize the results using the DeepSeek model via OpenRouter. It combines web scraping for up-to-date data with AI-powered summarization to deliver concise, informative responses for user queries.

## Features

- **Real-Time Data Retrieval**: Uses Firecrawl's search API to fetch and scrape recent web content when DeepSeek lacks current information.
- **AI-Powered Summarization**: Summarizes content into 40–120 word paragraphs using DeepSeek, ensuring key points are captured.
- **Fallback Mechanism**: Tries DeepSeek first, then falls back to Firecrawl if the response is outdated or insufficient.
- **Source Attribution**: Indicates whether results come from DeepSeek or Firecrawl.
- **Error Handling**: Robust handling for API failures, invalid keys, and network issues.
- **Testing Utility**: Includes a function to verify API configurations.

## Prerequisites

- **Node.js**: Version 18 or higher.
- **API Keys**:
  - Firecrawl API key ([sign up](https://www.firecrawl.dev/)).
  - OpenRouter API key ([sign up](https://openrouter.ai/)).
- **Environment Variables**: Store API keys in a `.env` file.


## ⚙️ How It Works

1. **Query Processing**  
   `searchAndSummarize(query)` accepts a user query (e.g., `"recent developments in AI 2025"`).  
   It first tries to fetch a response using **DeepSeek** via **OpenRouter**.

2. **Fallback to Firecrawl**  
   If DeepSeek’s response is outdated or fails, the code falls back to **Firecrawl**’s real-time web search and scraping API, which returns markdown-formatted content from up to three top sources.

3. **Summarization**  
   - Retrieved content is truncated to **1500 characters** to respect API limits.  
   - DeepSeek condenses the content into a **40–120-word** paragraph.

4. **Output**  
   The final result is a concise summary with source attribution (e.g., `Source: Firecrawl`).

---

## 🌐 API Details

### 🔥 Firecrawl
- **Endpoint:** `https://api.firecrawl.dev/v1/search`  
- Real-time web search and scraping.  
- Returns markdown-formatted content from top search results.

### 🤖 OpenRouter (DeepSeek)
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`  
- **Models:** `deepseek/deepseek-chat:free`, `deepseek/deepseek-r1`  
- Used for initial query handling and summarization.

---

## 🔧 Configuration

### Environment Variables _(in `.env`)_
```env
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
VITE_FIRECRAWL_API_KEY=fc-your_firecrawl_api_key

----

## 🛡️ Error Handling

The code gracefully manages:

- ❌ Missing or invalid API keys  
- ⚠️ API rate limits (`HTTP 429`)  
- 🌐 Network errors or failed requests  
- 🔁 Insufficient or outdated responses (triggers Firecrawl fallback)

---

## ⚠️ Limitations

- **API Quotas:** Firecrawl and OpenRouter enforce usage limits  
- **Content Length:** Input is truncated to **1500 characters** to comply with summarization limits  
- **Web Data Dependency:** Firecrawl’s effectiveness depends on the **availability and quality** of web content

---

## 🌱 Potential Improvements

- **Caching:** Store recent query results to reduce redundant API calls  
- **Custom Models:** Add support for other LLMs (e.g., Claude, GPT-4o)  
- **Prompt Engineering:** Test alternative prompts to improve summarization quality  
- **Rate Limiting:** Implement **exponential backoff** for handling `HTTP 429` errors

---

## 📚 Resources

- 🔥 [Firecrawl Documentation](https://docs.firecrawl.dev/)  
- 🤖 [OpenRouter Documentation](https://openrouter.ai/docs)  
- 📘 [DeepSeek Model Details](https://deepseek.com/)
