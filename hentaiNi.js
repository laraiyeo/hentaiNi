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
      return {
        title: a.getAttribute('title') || a.textContent.trim(),
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

    const desc = doc.querySelector('.entry-content p')?.textContent?.trim() || 'No description';
    const aliases = doc.querySelector('.single-anime-info li strong:contains("Japanese:")')?.nextSibling?.textContent?.trim() || '';
    const airdate = doc.querySelector('.single-anime-info li strong:contains("Aired:")')?.nextSibling?.textContent?.trim() || 'Unknown';

    return JSON.stringify({ description: desc, aliases, airdate });
  } catch (e) {
    console.log('extractDetails error: ' + e);
    return JSON.stringify({ description: 'Error', aliases: '', airdate: '' });
  }
}

async function extractEpisodes(url) {
  try {
    const html = await soraFetch(url);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('table.episodes-table tbody tr')];

    const episodes = rows.map(tr => {
      const num = parseInt(tr.querySelector('td:first-child')?.textContent || '0', 10);
      const a = tr.querySelector('a');
      return { href: a?.href || '', number: num };
    }).filter(ep => ep.number > 0);

    return JSON.stringify(episodes);
  } catch (e) {
    console.log('extractEpisodes error: ' + e);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  try {
    const html = await soraFetch(url);
    const m3u8 = html.match(/(https:\/\/vs1\.yesterdaymail\.com\/series\/[^"]+\.m3u8)/)?.[1];

    if (!m3u8) return JSON.stringify({ streams: [] });

    return JSON.stringify({
      streams: [{ title: 'HentaiNi', streamUrl: m3u8, headers: { Referer: 'https://hentaini.com/' } }]
    });
  } catch (e) {
    console.log('extractStreamUrl error: ' + e);
    return JSON.stringify({ streams: [] });
  }
}

/* mini-DOMParser + fetch poly for Sora sandbox */
function DOMParser() {
  this.parseFromString = function (src) {
    const div = document.createElement('div'); div.innerHTML = src; return div;
  };
}