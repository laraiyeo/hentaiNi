/* HentaiWorld Sora Module v1.0.2 */

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

    // Use the exact same search logic you tested in the HTML, but wrap in soraFetch
    const res  = await soraFetch(`https://hentaiworld.tv/?s=${encodedKeyword}`, { headers: {} });
    const html = await res.text();

    const results = [];
    const itemRegex = /<article[^>]*class="[^"]*post-[0-9]+[^"]*"[^>]*>[\s\S]*?<a href="(https:\/\/hentaiworld\.tv\/hentai-videos\/[^"]+)"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="(\/\/hentaiworldtv\.b-cdn\.net\/wp-content\/uploads\/[^\s"]+)[^>]*>[\s\S]*?<\/article>/g;

    let match;
    while ((match = itemRegex.exec(html)) !== null) {
      const url   = match[1];
      const title = match[2].trim();
      let   image = match[3];

      // Fix protocol‐relative image URLS (exactly as did in the HTML test)
      if (image.startsWith('//')) image = `https:${image}`;

      // De-duplicate – optional but recommended
      if (!results.some(r => r.href === url)) {
        results.push({ title, image, href: url });
      }
    }

    return JSON.stringify(results);
  } catch (e) {
    console.warn('[HentaiWorld/search] '+e.message);
    return '[]';
  }
}

// -------------- details -----------------
async function extractDetails(url) {
  try {
    const html = await (await soraFetch(url, { headers: {} })).text();

    // Title
    const titleMatch = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

    // Synopsis
    const descMatch = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)(?:<div class="episode-info-container">|<div class="wpulike|<\/div>)/i);
    let description = 'No description available';
    if (descMatch) {
      description = descMatch[1]
        .replace(/<br\s*\/?>/gi,'\n')
        .replace(/<[^>]+>/g,'')
        .replace(/\s+/g,' ')
        .trim()
        .substring(0,500);
    }

    // Release date
    let airdate = 'Unknown';
    const dateMatch = html.match(/Release Date:[\s\n]*([0-9\/]+)/i);
    if (dateMatch) airdate = dateMatch[1];

    return JSON.stringify({ description, aliases: title, airdate: `Released: ${airdate}` });
  } catch (e) {
    console.warn('[HentaiWorld/details] '+e.message);
    return JSON.stringify({ description:'Error', aliases:'Error', airdate:'Error' });
  }
}

// -------------- episodes -----------------
async function extractEpisodes(url) {
  // Every HentaiWorld page is just one episode; mirror that exactly.
  return JSON.stringify([{ href: url, number: 1 }]);
}

// -------------- stream (copy/pasted from HTML) --------------
async function extractStreamUrl(url) {
  try {
    const html = await (await soraFetch(url, { headers: {} })).text();

    // 1. Try window.open( … .mp4, '_blank' )
    const downloadMatch = html.match(/window\.open\('([^']*\.mp4)', '_blank'\)/);
    if (downloadMatch) {
      const mp4 = downloadMatch[1];
      console.log('[HentaiWorld] got direct MP4 from download: '+mp4);
      return JSON.stringify({
        streams:[{
          title:'Download MP4',
          streamUrl: mp4,
          headers:{Referer:'https://hentaiworld.tv/'}
        }]
      });
    }

    // 2. Fallback – build from video-player.html?…  (exact HTML logic)
    const scriptMatch = html.match(/window\.setTimeout\(function\s*\(\)\s*{\s*var\s+iframe\s*=\s*document\.getElementById\('videoPlayer'\);\s*iframe\.setAttribute\('src',\s*'([^']+)'\)\s*},\s*250\);/);
    if (!scriptMatch) throw new Error('Cannot find MP4 src');

    let playerUrl = scriptMatch[1];
    if (playerUrl.startsWith('//')) playerUrl = 'https:'+playerUrl;
    else if (playerUrl.startsWith('/')) playerUrl = 'https://hentaiworld.tv'+playerUrl;

    const qsMatch = playerUrl.match(/video-player\.html\?(.*)/);
    if (!qsMatch) throw new Error('Bad video-player path');

    const mp4url = 'https://hentaiworld.tv/' + qsMatch[1];
    console.log('[HentaiWorld] built MP4 URL from player src: '+mp4url);

    return JSON.stringify({
      streams:[{
        title:'Video MP4',
        streamUrl: mp4url,
        headers:{Referer:'https://hentaiworld.tv/'}
      }]
    });
  } catch (e) {
    console.warn('[HentaiWorld/stream] '+e.message);
    return JSON.stringify({ streams:[] });
  }
}