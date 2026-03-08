export default {
  async fetch(request, env, ctx) {
    try {
      const cache = caches.default;
      const url = new URL(request.url);
      const category = url.pathname.slice(1).toLowerCase(); // "/car" -> "car", "/" -> ""

      const cacheKey = new Request(`https://cache/wallpaper/${category || "all"}`);
      let response = await cache.match(cacheKey);

      let images = [];

      if (!response) {
        const repo = "skc-sketch112/wallpaper-image"; // Your GitHub repo

        if (category) {
          // Fetch images from that folder only
          const catRes = await fetch(`https://api.github.com/repos/${repo}/contents/${category}`, {
            headers: { "User-Agent": "Cloudflare-Worker" }
          });
          const catData = await catRes.json();

          if (!Array.isArray(catData)) return new Response("No images found", { status: 404 });

          images = catData
            .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
            .map(f => f.download_url);

          if (!images.length) return new Response("No images found", { status: 404 });
        } else {
          // Fetch all root images + folders
          const rootRes = await fetch(`https://api.github.com/repos/${repo}/contents`, {
            headers: { "User-Agent": "Cloudflare-Worker" }
          });
          const rootData = await rootRes.json();

          if (!Array.isArray(rootData)) return new Response("No images found", { status: 404 });

          // Add root images
          rootData
            .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
            .forEach(f => images.push(f.download_url));

          // Add folder images
          const folderFetches = rootData
            .filter(f => f.type === "dir")
            .map(async folder => {
              const folderRes = await fetch(`https://api.github.com/repos/${repo}/contents/${folder.name}`, {
                headers: { "User-Agent": "Cloudflare-Worker" }
              });
              const folderData = await folderRes.json();
              if (Array.isArray(folderData)) {
                const folderImages = folderData
                  .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
                  .map(f => f.download_url);
                images.push(...folderImages);
              }
            });

          await Promise.all(folderFetches);

          if (!images.length) return new Response("No images found", { status: 404 });
        }

        response = new Response(JSON.stringify(images), {
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }
        });

        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        images = await response.json();
      }

      // Pick random image
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
