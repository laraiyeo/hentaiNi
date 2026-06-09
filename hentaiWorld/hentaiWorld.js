/* HentaiWorld Sora Module v1.0.0 */

// -------------- fetch helpers -----------------
async function soraFetch(url, opts = {}) {
  try {
    return await fetchv2(url, opts.headers || {}, opts.method || 'GET', opts.body || null);
  } catch {
    return await fetch(url, opts);
  }
}

// -------------- search -----------------
async function searchResults(keyword) {
  try {
    const encodedKeyword = encodeURIComponent(keyword);
    const res = await soraFetch(`https://hentaiworld.tv/?s=${encodedKeyword}`);
    const html = await res.text();

    const results = [];
    // Match article elements in search results
    const itemRegex = /<article[^>]*class="[^"]*post-[0-9]+[^"]*"[^>]*>[\s\S]*?<a href="(https:\/\/hentaiworld\.tv\/hentai-videos\/[^"]+)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="(\/\/hentaiworldtv\.b-cdn\.net\/wp-content\/uploads\/[^\s"]+)[^>]*>[\s\S]*?<\/article>/g;
    
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();
      let image = match[3];
      
      // Fix image URL protocol
      if (image.startsWith('//')) {
        image = `https:${image}`;
      }
      
      // Avoid duplicates
      if (!results.some(r => r.href === url)) {
        results.push({
          title: title,
          image: image,
          href: url
        });
      }
    }

    return JSON.stringify(results);
  } catch (e) {
    console.log("Search Error:", e.message);
    return JSON.stringify([]);
  }
}

// -------------- show details ---------------
async function extractDetails(url) {
  try {
    const html = await (await soraFetch(url)).text();

    // Extract description (first paragraph after entry-content)
    const descMatch = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)(?:<div class="episode-info-container">|<div class="wpulike|<\/div>)/i);
    let description = 'No description available';
    if (descMatch) {
      description = descMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500); // Limit length
    }

    // Extract title from h1
    const titleMatch = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';

    // Extract release date
    let airdate = 'Unknown';
    const dateMatch = html.match(/Release Date:[\s\n]*([0-9\/]+)/i);
    if (dateMatch) {
      airdate = dateMatch[1];
    }

    return JSON.stringify({
      description: description,
      aliases: title,
      airdate: `Released: ${airdate}`
    });
  } catch (e) {
    console.log('Details Error:', e.message);
    return JSON.stringify({ 
      description: 'Error loading description', 
      aliases: 'Error', 
      airdate: 'Error' 
    });
  }
}

// -------------- episodes (series handling) ---------------
// Since HentaiWorld doesn't group episodes, we treat each video as its own "series"
async function extractEpisodes(url) {
  try {
    // In HentaiWorld, the "series" page IS the episode page
    // So we return just this one episode
    return JSON.stringify([{
      href: url,
      number: 1
    }]);
  } catch (e) {
    console.log('Episodes Error:', e.message);
    return JSON.stringify([]); 
  }
}

// -------------- stream ---------------
async function extractStreamUrl(url) {
  try {
    const html = await (await soraFetch(url)).text();
    
    // Extract iframe source for player
    const iframeMatch = html.match(/<iframe[^>]*id="videoPlayer"[^>]*src="([^"]*)"[^>]*>/i);
    if (!iframeMatch) throw new Error('Player iframe not found');
    
    let playerSrc = iframeMatch[1];
    if (playerSrc.startsWith('//')) {
      playerSrc = `https:${playerSrc}`;
    } else if (playerSrc.startsWith('/')) {
      playerSrc = `https://hentaiworld.tv${playerSrc}`;
    }
    
    // Fetch player page to get actual stream
    const playerRes = await soraFetch(playerSrc);
    const playerHtml = await playerRes.text();
    
    // Extract stream URL from player
    const streamMatch = playerHtml.match(/<source[^>]*src=["'](https?:\/\/[^"']*\.mp4)["'][^>]*>/i);
    if (!streamMatch) throw new Error('Stream URL not found in player');
    
    const streamUrl = streamMatch[1];
    
    return JSON.stringify({
      streams: [{
        title: 'HentaiWorld Stream',
        streamUrl: streamUrl,
        headers: { 
          Referer: 'https://hentaiworld.tv/'
        }
      }]
    });
  } catch (err) {
    console.log('Stream Error:', err.message);
    return JSON.stringify({ streams: [] });
  }
}