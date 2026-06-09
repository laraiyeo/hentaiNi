/* HentaiBros module for Sora */
/* eslint-disable no-undef */

async function searchResults(keyword) {
  try {
    const qs = encodeURIComponent(keyword);
    const html = await soraFetch(`https://hentaibros.net/?s=${qs}`);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = [...doc.querySelectorAll('article.loop-video')];

    const out = items.map(el => {
      const a = el.querySelector('a');
      const title = el.querySelector('.entry-header span')?.textContent?.trim() || 
                   el.getAttribute('data-video-id') || 'Unknown Title';
      const image = el.querySelector('img')?.src || '';
      
      return {
        title: title,
        image: image,
        href: a?.href || ''
      };
    }).filter(item => item.href && item.title);
    
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
    
    // For anime pages
    let description = doc.querySelector('.archive-description')?.textContent?.trim() || 
                     doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                     'No description available';
    
    // For episode pages
    if (!description || description === 'No description available') {
      description = doc.querySelector('.video-description .desc')?.textContent?.trim() || 
                   doc.querySelector('.entry-content')?.textContent?.trim() || 
                   'No description available';
    }
    
    const title = doc.querySelector('h1.entry-title')?.textContent?.trim() || 
                 doc.querySelector('title')?.textContent?.trim() || 
                 'Unknown Title';
                 
    return JSON.stringify({
      description: description,
      aliases: title,
      airdate: 'Unknown'
    });
  } catch (e) {
    console.log('extractDetails error: ' + e);
    return JSON.stringify({
      description: 'Error loading description',
      aliases: 'Unknown',
      airdate: 'Unknown'
    });
  }
}

async function extractEpisodes(url) {
  try {
    const html = await soraFetch(url);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Try to find episode links on anime page
    let episodeLinks = [...doc.querySelectorAll('article.loop-video a')];
    
    // If not found, try episode page pattern
    if (episodeLinks.length === 0) {
      const pathParts = url.split('/');
      const animeName = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1].replace(/\/$/, '');
      episodeLinks = [...doc.querySelectorAll(`a[href*="${animeName}"]`)];
    }
    
    const episodes = episodeLinks.map((a, index) => {
      const title = a.querySelector('.entry-header span')?.textContent?.trim() || 
                   a.textContent?.trim() || 
                   `Episode ${index + 1}`;
      
      // Extract episode number from title if possible
      const epMatch = title.match(/episode\s*(\d+)/i);
      const number = epMatch ? parseInt(epMatch[1]) : index + 1;
      
      return {
        href: a.href,
        number: number
      };
    }).filter(ep => ep.href);
    
    // Sort by episode number
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
    
    // Look for video sources in the HTML
    let videoUrl = '';
    
    // Try to find Flowplayer config
    const flowplayerMatch = html.match(/data-item=["']([^"']*)["']/);
    if (flowplayerMatch) {
      try {
        const dataItem = JSON.parse(decodeURIComponent(flowplayerMatch[1]));
        videoUrl = dataItem.sources?.[0]?.src || '';
      } catch (e) {
        // If JSON parsing fails, try to extract URL directly
        const sourcesMatch = flowplayerMatch[1].match(/src\\":\\"([^\\"]+)/);
        if (sourcesMatch) {
          videoUrl = sourcesMatch[1].replace(/\\\\/g, '\\').replace(/\\/g, '');
        }
      }
    }
    
    // Try alternative patterns if Flowplayer not found
    if (!videoUrl) {
      const mp4Match = html.match(/https?:\/\/.*?\.mp4/);
      if (mp4Match) {
        videoUrl = mp4Match[0];
      }
    }
    
    // Try video tag sources
    if (!videoUrl) {
      const videoTagMatch = html.match(/<source[^>]*src=["']([^"']+)/i);
      if (videoTagMatch) {
        videoUrl = videoTagMatch[1];
      }
    }
    
    if (!videoUrl) {
      console.log('No video URL found');
      return JSON.stringify({ streams: [] });
    }
    
    return JSON.stringify({
      streams: [{
        title: 'HentaiBros',
        streamUrl: videoUrl,
        headers: {
          Referer: 'https://hentaibros.net/'
        }
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