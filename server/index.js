import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

const app = express();
const PORT = 3001;
const PYTHON_SERVICE = 'http://localhost:5001';

app.use(cors());
app.use(express.json());

// ─── HTTP client with browser-like headers ────────────────────────────────────
const httpClient = axios.create({
  timeout: 20000,
  maxRedirects: 8,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,' +
      'image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  },
});

// ─── Article date extraction ──────────────────────────────────────────────────
function extractArticleDate(html, $) {
  // 1. OpenGraph / article meta tags
  const ogDate =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[property="og:updated_time"]').attr('content') ||
    $('meta[name="publish-date"]').attr('content') ||
    $('meta[name="publishdate"]').attr('content') ||
    $('meta[name="date"]').attr('content') ||
    $('meta[name="DC.date"]').attr('content') ||
    $('meta[itemprop="datePublished"]').attr('content');

  if (ogDate) return ogDate;

  // 2. <time> element with datetime attribute
  const timeEl = $('time[datetime]').first().attr('datetime');
  if (timeEl) return timeEl;

  // 3. JSON-LD structured data
  try {
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      const raw = $(jsonLdScripts[i]).html();
      if (!raw) continue;
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const date = item.datePublished || item.dateCreated || item.dateModified;
        if (date) return date;
      }
    }
  } catch (_) {}

  return null; // Caller falls back to "today"
}

// ─── Article text extraction (Readability + cheerio fallback) ─────────────────
function extractArticleText(html, url) {
  // ── Strategy 1: Mozilla Readability (works on ~95% of article sites) ──────
  try {
    const dom = new JSDOM(html, {
      url,
      // Suppress JSDOM resource loading warnings
      resources: 'usable',
      runScripts: 'outside-only',
    });

    const reader = new Readability(dom.window.document, {
      // Keep enough content for sentiment analysis
      charThreshold: 100,
      nbTopCandidates: 5,
    });
    const article = reader.parse();

    if (article && article.textContent) {
      const cleaned = article.textContent.replace(/\s+/g, ' ').trim();
      if (cleaned.length > 150) {
        console.log(`[Readability] Extracted ${cleaned.length} chars — title: "${article.title}"`);
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('[Readability] Failed, falling back to cheerio:', err.message);
  }

  // ── Strategy 2: Cheerio with comprehensive selector list ─────────────────
  return extractWithCheerio(html);
}

function extractWithCheerio(html) {
  const $ = cheerio.load(html);

  // Remove noise elements
  $(
    'script, style, nav, header, footer, aside, iframe, figure, ' +
    '.ad, .advertisement, .social-share, .related-stories, .comments, ' +
    '.sidebar, .widget, .newsletter, .cookie-banner, .popup, .modal, ' +
    '[class*="promo"], [class*="subscribe"], [id*="cookie"], ' +
    'noscript, svg'
  ).remove();

  // Ordered list of selectors — most specific first
  const selectors = [
    // Site-specific
    '.artText',                       // Economic Times
    '.article__body',                 // Mint / HBL
    '.story-content',                 // Reuters
    '.article-body-content',          // Moneycontrol
    '.content-body',                  // Bloomberg
    '[data-component="text-block"]',  // BBC
    '.caas-body',                     // Yahoo Finance
    '.paywall-article',
    // Generic article body
    'article[class*="article"]',
    'article[class*="story"]',
    '[class*="articleBody"]',
    '[class*="article-content"]',
    '[class*="article_content"]',
    '[class*="post-content"]',
    '[class*="post_content"]',
    '[class*="entry-content"]',
    '[class*="story-body"]',
    '[class*="body-content"]',
    '[itemprop="articleBody"]',
    '[itemprop="description"]',
    // Semantic HTML5
    'article',
    'main',
    '[role="main"]',
    // Last resort
    '.content',
    '#content',
    'body',
  ];

  for (const selector of selectors) {
    const text = $(selector).text().replace(/\s+/g, ' ').trim();
    if (text.length > 200) {
      console.log(`[Cheerio] Matched selector "${selector}", length=${text.length}`);
      return text;
    }
  }

  return $('body').text().replace(/\s+/g, ' ').trim();
}

// ─── Paragraph splitting ──────────────────────────────────────────────────────
function splitIntoParagraphs(text) {
  // Try natural paragraph breaks first
  let paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 60);

  // If we get very few or very long paragraphs, chunk by sentences
  const needsChunking =
    paragraphs.length < 3 || paragraphs.some((p) => p.length > 900);

  if (needsChunking) {
    const allText = paragraphs.join(' ') || text;
    const sentences = allText.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [allText];

    const chunks = [];
    let chunk = '';
    let sentCount = 0;

    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;

      if (sentCount >= 3 && chunk.length + s.length > 650) {
        if (chunk.length > 60) chunks.push(chunk.trim());
        chunk = s;
        sentCount = 1;
      } else if (chunk.length + s.length > 850) {
        if (chunk.length > 60) chunks.push(chunk.trim());
        chunk = s;
        sentCount = 1;
      } else {
        chunk += (chunk ? ' ' : '') + s;
        sentCount++;
      }
    }
    if (chunk.length > 60) chunks.push(chunk.trim());

    paragraphs = chunks;
  }

  return paragraphs.filter((p) => p.length > 60).slice(0, 30); // cap at 30 paragraphs
}

// ─── Main analysis endpoint ───────────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) return res.status(400).json({ error: 'URL is required' });

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // ── Fetch HTML ──────────────────────────────────────────────────────────
    let html;
    try {
      console.log('[Fetch] →', url);
      const response = await httpClient.get(url);
      html = response.data;
      console.log(`[Fetch] OK — ${html.length} bytes`);
    } catch (err) {
      const msg = err.response
        ? `HTTP ${err.response.status}: ${err.response.statusText}`
        : err.message;
      console.error('[Fetch] Error:', msg);
      return res.status(400).json({ error: `Failed to fetch article: ${msg}` });
    }

    // ── Parse metadata ──────────────────────────────────────────────────────
    const $ = cheerio.load(html);
    const articleDate = extractArticleDate(html, $);
    if (articleDate) console.log('[Date] Article date:', articleDate);

    // ── Extract text ────────────────────────────────────────────────────────
    const articleText = extractArticleText(html, url);
    console.log(`[Text] Extracted ${articleText.length} chars`);

    if (!articleText || articleText.length < 100) {
      return res
        .status(400)
        .json({ error: 'Could not extract enough text from this page' });
    }

    // ── Split into paragraphs ───────────────────────────────────────────────
    const paragraphs = splitIntoParagraphs(articleText);
    console.log(`[Split] ${paragraphs.length} paragraphs`);

    if (paragraphs.length === 0) {
      return res.status(400).json({ error: 'No paragraphs found in article' });
    }

    // ── Call Python Flask service (single call, batched) ───────────────────
    let pythonData;
    try {
      const pythonResponse = await axios.post(
        `${PYTHON_SERVICE}/analyze`,
        { paragraphs, article_date: articleDate },
        { timeout: 120000 }
      );
      pythonData = pythonResponse.data;
    } catch (err) {
      const msg = err.code === 'ECONNREFUSED'
        ? 'Python service is not running. Please start flask_service.py on port 5001.'
        : `Python service error: ${err.message}`;
      console.error('[Python]', msg);
      return res.status(503).json({ error: msg });
    }

    const analysisResults = pythonData.results;

    // ── Compute summary statistics ──────────────────────────────────────────
    const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0 };
    let totalConfidence = 0;
    let totalClaims = 0;
    let verifiedClaims = 0;
    let disputedClaims = 0;

    for (const r of analysisResults) {
      sentimentCounts[r.sentiment] = (sentimentCounts[r.sentiment] || 0) + 1;
      totalConfidence += r.confidence;

      if (r.claims) {
        totalClaims += r.claims.length;
        verifiedClaims  += r.claims.filter((c) => c.verdict === 'VERIFIED').length;
        disputedClaims  += r.claims.filter((c) => c.verdict === 'DISPUTED').length;
      }
    }

    const total = analysisResults.length;
    const avgConfidence = totalConfidence / total;

    let overallSentiment = 'Neutral';
    if (
      sentimentCounts.Positive > sentimentCounts.Negative &&
      sentimentCounts.Positive > sentimentCounts.Neutral
    ) {
      overallSentiment = 'Positive';
    } else if (
      sentimentCounts.Negative > sentimentCounts.Positive &&
      sentimentCounts.Negative > sentimentCounts.Neutral
    ) {
      overallSentiment = 'Negative';
    }

    res.json({
      success: true,
      url,
      articleDate,
      totalParagraphs: total,
      paragraphs: analysisResults,
      summary: {
        overall: overallSentiment,
        distribution: sentimentCounts,
        averageConfidence: avgConfidence,
        factCheck: {
          totalClaims,
          verifiedClaims,
          disputedClaims,
          unverifiableClaims: totalClaims - verifiedClaims - disputedClaims,
        },
      },
    });
  } catch (err) {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Health check (pings Python service too) ─────────────────────────────────
app.get('/api/health', async (req, res) => {
  let pythonStatus = 'unknown';
  try {
    const r = await axios.get(`${PYTHON_SERVICE}/health`, { timeout: 3000 });
    pythonStatus = r.data;
  } catch {
    pythonStatus = 'unreachable';
  }
  res.json({ status: 'ok', pythonService: pythonStatus });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Node API running on http://localhost:${PORT}`);
  console.log(`   Requires Python Flask service on http://localhost:5001\n`);
});
