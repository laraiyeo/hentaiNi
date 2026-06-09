/* HentaiHaven Sora Module v1.0.1
   Compatible with fetchv2 / soraFetch
   (use same helpers as your working.js)
*/

// -------------- fetch helpers -----------------
async function soraFetch(url, opts = {}) {
  try {                       // fetchv2 from embedded runtime first
    return await fetchv2(url, opts.headers || {}, opts.method || 'GET', opts.body || null);
  } catch {
    return await fetch(url, opts); // fall back
  }
}

// --------------          search -----------------
async function searchResults(keyword) {
  try {
    const res = await soraFetch(`https://hentaihaven.xxx/?s=${encodeURIComponent(keyword)}`);
    const html = await res.text();

    const out = [];
    // item card: <a href="URL"><img src="POSTER" alt="TITLE">
    const r = /<a href="(https:\/\/hentaihaven\.xxx\/hentai\/[^"]+)".*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"[^>]*>/g;
    let m;
    while ((m = r.exec(html)) !== null) {
      out.push({ title: m[3].trim(), image: m[2], href: m[1] });
    }
    return JSON.stringify(out);
  } catch (e) {
    return JSON.stringify([]);
           // returned: [{title, image, href}]
  }
}

// --------------      show details ---------------
async function extractDetails(url) {
  try {
    const html = await(await soraFetch(url)).text();

    const title = html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1].trim() ?? '';
    const desc = html.match(/<div class="post-content">([\s\S]*?)<\/div>/i)?.[1].replace(/<[^>]*>/g, '').trim() ?? '';
    const year = html.match(/(Released|Aired).*?(\d{4})/i)?.[2] ?? 'Unknown';

    return JSON.stringify({
      description: desc,
      aliases: title,
      airdate: year
    });
  } catch {
    return JSON.stringify({ description: 'Error', aliases: 'Error', airdate: 'Error' });
  }
}

// --------------          episodes ---------------
async function extractEpisodes(url) {
  try {
    const html = await(await soraFetch(url)).text();

    const eps = [];
    const r = /<a href="(https:\/\/hentaihaven\.xxx\/watch\/[^"]+)".*?Episode\s+(\d+)/gi;
    let m;
    while ((m = r.exec(html)) !== null) {
      eps.push({ href: m[1], number: parseInt(m[2], 10) });
    }
    eps.sort((a, b) => a.number - b.number);
    return JSON.stringify(eps);
  } catch { return JSON.stringify([]); }
}

// --------------           stream ---------------
async function extractStreamUrl(url) {
  try {
    const html = await(await soraFetch(url)).text();

    // main .m3u8 (normal HLS) or fallback mp4
    let src =
      html.match(/file["\s]*:\s*["']([^"',]+\.m3u8)["']/i)?.[1]
      || html.match(/<source[^>]+src=["']([^"']+\.(m3u8|mp4))["']/i)?.[1];
    if (!src) throw new Error('No stream');

    return JSON.stringify({
      streams: [{
        title: 'HH Main',
        streamUrl: src,
        headers: { Referer: 'https://hentaihaven.xxx/' }
      }]
    });
  } catch {
    return JSON.stringify({ streams: [] });
  }
}