export default {
  async fetch(request, env, ctx) {
    try {
      const cache = caches.default;
      const url = new URL(request.url);
      const category = url.pathname.slice(1).toLowerCase(); // "/car" -> "car", "/" -> ""

      const cacheKey = new Request(`https://cache/wallpaper/${category || "all"}`);
      let response = await cache.match(cacheKey);

      let images;

      if (response) {
        images = await response.json();
      } else {
        const repo = "skc-sketch112/wallpaper-image"; // your GitHub repo
        let apiUrls = [];

        if (category) {
          // Only fetch images from the specific category folder
          apiUrls.push(`https://api.github.com/repos/${repo}/contents/${category}`);
        } else {
          // Fetch root folder and all category folders
          const rootRes = await fetch(`https://api.github.com/repos/${repo}/contents`, {
            headers: { "User-Agent": "Cloudflare-Worker" }
          });
          const rootData = await rootRes.json();

          if (!Array.isArray(rootData)) {
            throw new Error(`GitHub API returned invalid data: ${JSON.stringify(rootData)}`);
          }

          // Add root images
          rootData
            .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
            .forEach(f => apiUrls.push(f.download_url));

          // Add all category folders
          rootData
            .filter(f => f.type === "dir")
            .forEach(f => apiUrls.push(`https://api.github.com/repos/${repo}/contents/${f.name}`));
        }

        images = [];

        for (let apiUrl of apiUrls) {
          // If direct image URL, just add
          if (/\.(jpg|jpeg|png|webp|gif)$/i.test(apiUrl)) {
            images.push(apiUrl);
            continue;
          }

          // Fetch folder content
          const res = await fetch(apiUrl, { headers: { "User-Agent": "Cloudflare-Worker" } });
          const data = await res.json();

          if (!Array.isArray(data)) continue;

          const folderImages = data
            .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
            .map(f => f.download_url);

          images.push(...folderImages);
        }

        if (!images.length) return new Response("No images found", { status: 404 });

        // Cache the list for 1 hour
        response = new Response(JSON.stringify(images), {
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      // Pick a random image
      const random = images[Math.floor(Math.random() * images.length)];
      const img = await fetch(random);

      return new Response(img.body, {
        headers: {
          "Content-Type": img.headers.get("Content-Type"),
          "Cache-Control": "public, max-age=86400"
        }
      });

    } catch (err) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  }
};
