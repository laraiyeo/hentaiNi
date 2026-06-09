/* HentaiHaven Sora Module v1.0.3
   Complete rewrite with proper HTML parsing based on test.html findings
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
    
    // Method 1: Look for tab-content-wrap sections with actual results
    const tabContentMatches = html.match(/<div class="tab-content-wrap">[\s\S]*?<div role="tabpanel"[^>]*class="[^"]*c-tabs-item[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi);
    if (tabContentMatches && tabContentMatches.length > 0) {
      for (let t = 0; t < tabContentMatches.length; t++) {
        const tabContent = tabContentMatches[t];
        // Extract individual result items
        const resultItems = tabContent.match(/<div class="c-tabs-item__content[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi) || [];
        
        for (let i = 0; i < resultItems.length; i++) {
          const item = resultItems[i];
          
          // Try various patterns for title extraction
          const titleMatch = item.match(/<h3 class="h4"><a href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]+)">([^<]+)<\/a><\/h3>/i);
          const titleMatch2 = item.match(/<h3 class="h4">\s*<a[^>]*href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]+)"[^>]*>([^<]+)<\/a>\s*<\/h3>/i);
          const titleMatch3 = item.match(/<h3 class="h4">[^<]*<a[^>]*href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]+)"[^>]*>([^<]+)<\/a>/i);
          
          // Extract image
          const imgMatch = item.match(/<img src="([^"]+)" alt="([^"]+) cover"[^>]*>/i);
          
          if (titleMatch) {
            out.push({
              title: titleMatch[2].trim(),
              image: imgMatch ? imgMatch[1] : "",
              href: titleMatch[1]
            });
          } else if (titleMatch2) {
            out.push({
              title: titleMatch2[2].trim(),
              image: imgMatch ? imgMatch[1] : "",
              href: titleMatch2[1]
            });
          } else if (titleMatch3) {
            out.push({
              title: titleMatch3[2].trim(),
              image: imgMatch ? imgMatch[1] : "",
              href: titleMatch3[1]
            });
          } else if (imgMatch) {
            // Use image alt text as title fallback
            const hrefMatch = item.match(/href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]+)"/i);
            if (hrefMatch) {
              out.push({
                title: imgMatch[2].trim(),
                image: imgMatch[1],
                href: hrefMatch[1]
              });
            }
          }
        }
      }
    }

    // Method 2: Fallback to finding all c-tabs-item__content items directly
    if (out.length === 0) {
      const allItems = html.match(/<div class="c-tabs-item__content[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi) || [];
      
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        
        if (item.includes('/watch/')) {
          // Extract href
          const hrefMatch = item.match(/href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]+)"/i);
          
          // Extract title from various patterns
          const titleMatch1 = item.match(/<h3 class="h4">[^<]*<a[^>]*href="[^"]*"[^>]*>([^<]+)<\/a>/i);
          const titleMatch2 = item.match(/<a[^>]*href="https:\/\/hentaihaven\.xxx\/watch\/[^"]+"[^>]*>([^<]+)<\/a>/i);
          
          // Extract image and alt text
          const imgMatch = item.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]+) cover/i);
          
          if (hrefMatch) {
            const title = titleMatch1 ? titleMatch1[1] : 
                         titleMatch2 ? titleMatch2[1] : 
                         (imgMatch ? imgMatch[2] : "Unknown Title");
            
            // Check for duplicates
            const alreadyExists = out.some(r => r.href === hrefMatch[1]);
            if (!alreadyExists) {
              out.push({
                title: title.trim(),
                image: imgMatch ? imgMatch[1] : "",
                href: hrefMatch[1]
              });
            }
          }
        }
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

    // Extract title
    const titleMatch = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/i) || 
                      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

    // Extract description
    const descMatch = html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    let description = 'No description available';
    if (descMatch) {
      description = descMatch[1]
        .replace(/<br[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Extract year
    const yearMatch = html.match(/<div[^>]*class="[^"]*release-year[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                     html.match(/Release.*?(\d{4})/i);
    const year = yearMatch ? (yearMatch[1].match(/\d{4}/) || ['Unknown'])[0] : 'Unknown';

    return JSON.stringify({
      description: description,
      aliases: title,
      airdate: year
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

// --------------          episodes ---------------
async function extractEpisodes(url) {
  try {
    const html = await(await soraFetch(url)).text();

    const episodes = [];
    
    // Extract the base URL path to filter episodes
    const baseUrlMatch = url.match(/(https:\/\/hentaihaven\.xxx\/watch\/[^\/]+)\//);
    const baseUrl = baseUrlMatch ? baseUrlMatch[1] : url.replace(/\/$/, '');

    // Method 1: Look for the select picker with episode options
    const selectMatch = html.match(/<select[^>]*class="[^"]*single-chapter-select[^"]*"[^>]*>([\s\S]*?)<\/select>/i);
    if (selectMatch) {
      const selectContent = selectMatch[1];
      const optionPattern = /<option[^>]*data-redirect="([^"]*)"[^>]*>([^<]+)<\/option>/gi;
      
      let match;
      while ((match = optionPattern.exec(selectContent)) !== null) {
        const href = match[1];
        const text = match[2].trim();
        
        if (href && text) {
          const numMatch = text.match(/Episode\s*(\d+)/i);
          const number = numMatch ? parseInt(numMatch[1], 10) : episodes.length + 1;
          
          let fullHref = href;
          if (href.startsWith('/')) {
            fullHref = `https://hentaihaven.xxx${href}`;
          }
          
          episodes.push({
            href: fullHref,
            number: number
          });
        }
      }
    }

    // Method 2: Fallback to direct episode URL pattern matching
    if (episodes.length === 0) {
      const episodeUrlPattern = /href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]*\/episode-(\d+))"/gi;
      let match;
      
      while ((match = episodeUrlPattern.exec(html)) !== null) {
        const fullUrl = match[1];
        const episodeNumber = parseInt(match[2], 10);
        
        // Filter to only include episodes from the current series
        if (fullUrl.includes(baseUrl)) {
          const alreadyExists = episodes.some(ep => ep.href === fullUrl);
          if (!alreadyExists) {
            episodes.push({
              href: fullUrl,
              number: episodeNumber
            });
          }
        }
      }
    }

    episodes.sort((a, b) => a.number - b.number);
    return JSON.stringify(episodes);
  } catch (e) {
    console.log('Episodes Error:', e.message);
    return JSON.stringify([]); 
  }
}

// --------------           stream ---------------
async function extractStreamUrl(url) {
  try {
    const html = await(await soraFetch(url)).text();

    // Look for stream URLs
    let streamSrc = html.match(/file\s*:\s*["']([^"']+\.(m3u8|mp4))["']/i)?.[1] ||
                    html.match(/source[^>]+src=["']([^"']+\.(m3u8|mp4))["']/i)?.[1] ||
                    html.match(/<[^>]+src=["']([^"']+\.(?:m3u8|mp4|flv|webm))["']/i)?.[1];

    // Try iframe sources
    if (!streamSrc) {
      const iframeMatch = html.match(/<iframe[^>]+src=["'](https?:[^"']*)["']/i);
      if (iframeMatch) {
        streamSrc = iframeMatch[1];
      }
    }

    // Try javascript sources
    if (!streamSrc) {
      const jsMatch = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.(m3u8|mp4))["']/i) || 
                     html.match(/videoUrl\s*=\s*["']([^"']+)["']/i);
      if (jsMatch) {
        streamSrc = jsMatch[1];
      }
    }

    if (!streamSrc) throw new Error('No stream found');

    return JSON.stringify({
      streams: [{
        title: 'HentaiHaven Main',
        streamUrl: streamSrc,
        headers: { Referer: 'https://hentaihaven.xxx/' }
      }]
    });
  } catch (err) {
    console.log('Stream Error:', err.message);
    return JSON.stringify({ streams: [] });
  }
}