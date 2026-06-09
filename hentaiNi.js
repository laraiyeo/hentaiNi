/* HentaiNi module for old-Sora */
/* eslint-disable no-undef */

async function searchResults(keyword) {
  try {
    const qs = encodeURIComponent(keyword);
    const html = await soraFetch(`https://hentaini.com/?s=${qs}`);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = [...doc.querySelectorAll('article.item')];

    const out = items.map(el => {
      const a = el.querySelector('a');
      const titleElement = el.querySelector('.entry-title, .title, h3, h2');
      const title = titleElement ? titleElement.textContent.trim() : 
                   (a.getAttribute('title') || a.textContent.trim());
      
      return {
        title: title,
        image: el.querySelector('img')?.src || '',
        href: a.href
      };
    });
    return JSON.stringify(out);
  } catch (e) {
    console.log('searchResults error: ' + e);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    const html = await soraFetch(url);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Try multiple selectors for synopsis
    const descSelectors = [
      '.entry-content p',
      '.synopsis p',
      '[property="og:description"]',
      'meta[name="description"]'
    ];
    
    let desc = 'No description';
    for (let selector of descSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        desc = element.getAttribute('content') || element.textContent?.trim() || 'No description';
        if (desc !== 'No description') break;
      }
    }

    // Try to find genre/tags info
    const genres = [...doc.querySelectorAll('.genre a, .tags a, [href*="genre"]')]
      .map(el => el.textContent.trim())
      .filter(text => text.length > 0)
      .join(', ');

    return JSON.stringify({ 
      description: desc,
      aliases: genres || 'No genres',
      airdate: 'Unknown'
    });
  } catch (e) {
    console.log('extractDetails error: ' + e);
    return JSON.stringify({ description: 'Error loading details', aliases: '', airdate: 'Unknown' });
  }
}

async function extractEpisodes(url) {
  try {
    const html = await soraFetch(url);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Look for episode links in various possible locations
    const episodeLinks = [...doc.querySelectorAll('a[href*="/h/"][href*="/"]')].filter(a => {
      // Filter to only episode links (should contain both anime name and episode number)
      const href = a.href;
      const pathParts = href.split('/').filter(part => part);
      return pathParts.length >= 3 && /^\d+$/.test(pathParts[pathParts.length - 1]);
    });

    const episodes = episodeLinks.map((a, index) => {
      const href = a.href;
      // Try to extract episode number from URL or text
      const urlMatch = href.match(/\/(\d+)(?:\/?)$/);
      const textMatch = a.textContent.match(/(?:episode|ep|)\s*(\d+)/i);
      const number = urlMatch ? parseInt(urlMatch[1]) : 
                    (textMatch ? parseInt(textMatch[1]) : index + 1);
      
      return { 
        href: href, 
        number: number 
      };
    });

    // If no episodes found, try alternative method
    if (episodes.length === 0) {
      const episodeRows = [...doc.querySelectorAll('.episodes-table tbody tr, .episode-list li, [class*="episode"]')];
      episodeRows.forEach((row, index) => {
        const a = row.querySelector('a');
        if (a) {
          const textMatch = row.textContent.match(/(?:episode|ep|)\s*(\d+)/i);
          const number = textMatch ? parseInt(textMatch[1]) : index + 1;
          episodes.push({ href: a.href, number: number });
        }
      });
    }

    // Sort episodes by number
    episodes.sort((a, b) => a.number - b.number);
    
    return JSON.stringify(episodes);
  } catch (e) {
    console.log('extractEpisodes error: ' + e);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  try {
    const html = await soraFetch(url);
    
    // Look for the m3u8 URL pattern from your example
    const m3u8Match = html.match(/(https:\/\/vs1\.yesterdaymail\.com\/series\/[^"']+\.m3u8)/);
    const m3u8 = m3u8Match ? m3u8Match[1] : null;

    if (!m3u8) {
      // Try alternative patterns
      const patterns = [
        /https?:\/\/[^"']*\.m3u8/,
        /source:\s*['"]([^'"]+\.m3u8)['"]/,
        /file:\s*['"]([^'"]+\.m3u8)['"]/
      ];
      
      for (let pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          m3u8 = match[1];
          break;
        }
      }
    }

    if (!m3u8) {
      console.log('No m3u8 URL found in page');
      return JSON.stringify({ streams: [] });
    }

    return JSON.stringify({
      streams: [{ 
        title: 'HentaiNi', 
        streamUrl: m3u8, 
        headers: { Referer: 'https://hentaini.com/' } 
      }]
    });
  } catch (e) {
    console.log('extractStreamUrl error: ' + e);
    return JSON.stringify({ streams: [] });
  }
}

/* mini-DOMParser + fetch poly for Sora sandbox */
function DOMParser() {
  this.parseFromString = function (src) {
    const div = document.createElement('div'); 
    div.innerHTML = src; 
    return div;
  };
}