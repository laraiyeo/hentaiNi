/* HentaiHaven Sora Module v1.0.2
   Fixed search parsing to match actual HTML structure
*/

// -------------- fetch helpers -----------------
async function soraFetch(url, opts = {}) {
  try {
    return await fetchv2(url, opts.headers || {}, opts.method || 'GET', opts.body || null);
  } catch {
    return await fetch(url, opts);
  }
}

// --------------          search -----------------
async function searchResults(keyword) {
  try {
    const res = await soraFetch(`https://hentaihaven.xxx/?s=${encodeURIComponent(keyword)}`);
    const html = await res.text();

    const out = [];
    // Parse search results from the actual HTML structure
    // Looking for: <div class="c-tabs-item__content"> ... <h3 class="h4"><a href="URL">Title</a></h3>
    const itemRegex = /<div class="c-tabs-item__content[^>]*>[\s\S]*?<a href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<h3 class="h4"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
    
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
      out.push({
        title: match[3].trim(),
        image: match[2],
        href: match[1]
      });
    }
    
    // Alternative parsing method if the above doesn't work
    if (out.length === 0) {
      // Try parsing from the tab-thumb structure
      const altRegex = /<div class="tab-thumb[^>]*>[\s\S]*?<a href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]+)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/g;
      let altMatch;
      while ((altMatch = altRegex.exec(html)) !== null) {
        out.push({
          title: altMatch[2].trim(),
          image: altMatch[3],
          href: altMatch[1]
        });
      }
    }

    return JSON.stringify(out);
  } catch (e) {
    console.log("Search Error:", e.message);
    return JSON.stringify([]);
  }
}

// --------------      show details ---------------
async function extractDetails(url) {
  try {
    const html = await(await soraFetch(url)).text();

    // Extract title from h1
    const titleMatch = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/i) || 
                      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

    // Extract description from post-content
    const descMatch = html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    let description = 'No description available';
    if (descMatch) {
      // Clean up HTML tags from description
      description = descMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || 'No description available';
    }

    // Extract release year
    const yearMatch = html.match(/<div[^>]*class="[^"]*release-year[^"]*"[^>]*>[\s\S]*?<a[^>]*>(\d{4})<\/a>/i) ||
                     html.match(/Release.*?(\d{4})/i);
    const year = yearMatch ? yearMatch[1] : 'Unknown';

    return JSON.stringify({
      description: description,
      aliases: title,
      airdate: year
    });
  } catch {
    return JSON.stringify({ 
      description: 'Error loading description', 
      aliases: 'Error', 
      airdate: 'Error' 
    });
  }
}

// --------------          episodes ---------------
async function extractEpisodes(url) {
  try {
    const html = await(await soraFetch(url)).text();

    const episodes = [];
    // Parse episodes from the HTML
    const episodeRegex = /<a[^>]*href="(https:\/\/hentaihaven\.xxx\/watch\/[^\/]+\/[^"]+)"[^>]*>[^<]*Episode\s+(\d+)[^<]*<\/a>/gi;
    
    let match;
    while ((match = episodeRegex.exec(html)) !== null) {
      episodes.push({
        href: match[1],
        number: parseInt(match[2], 10)
      });
    }

    // Alternative method: look for episode list structure
    if (episodes.length === 0) {
      const altRegex = /<div[^>]*class="[^"]*latest-chap[^"]*"[^>]*>[\s\S]*?<a[^>]*href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]+)"[^>]*>[^<]*Episode\s+(\d+)[^<]*<\/a>/gi;
      let altMatch;
      while ((altMatch = altRegex.exec(html)) !== null) {
        episodes.push({
          href: altMatch[1],
          number: parseInt(altMatch[2], 10)
        });
      }
    }

    episodes.sort((a, b) => a.number - b.number);
    return JSON.stringify(episodes);
  } catch { 
    return JSON.stringify([]); 
  }
}

// --------------           stream ---------------
async function extractStreamUrl(url) {
  try {
    const html = await(await soraFetch(url)).text();

    // Look for common video source patterns in HentaiHaven
    let src = html.match(/file["\s]*:[\s]*["']([^"']+\.(m3u8|mp4))["']/i)?.[1] ||
              html.match(/source[^>]+src=["']([^"']+\.(m3u8|mp4))["']/i)?.[1] ||
              html.match(/<source[^>]+src=["']([^"']+\.(m3u8|mp4))["']/i)?.[1];

    if (!src) {
      // Try to find iframe sources
      const iframeMatch = html.match(/<iframe[^>]+src=["'](https?:[^"']*)["']/i);
      if (iframeMatch) {
        // For iframes, we might need to extract from the embedded page
        src = iframeMatch[1];
      }
    }

    if (!src) throw new Error('No stream found');

    return JSON.stringify({
      streams: [{
        title: 'HentaiHaven Main',
        streamUrl: src,
        headers: { Referer: 'https://hentaihaven.xxx/' }
      }]
    });
  } catch (err) {
    console.log('Stream Error:', err.message);
    return JSON.stringify({ streams: [] });
  }
}