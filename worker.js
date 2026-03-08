export default {
  async fetch(request, env, ctx) {
    try {
      const cache = caches.default;

      // Extract category from URL
      const url = new URL(request.url);
      const category = url.pathname.slice(1).toLowerCase(); // /car -> car

      const cacheKey = new Request(`https://cache/wallpaper/${category}`);
      let response = await cache.match(cacheKey);

      let images;

      if (response) {
        images = await response.json();
      } else {
        const repo = "skc-sketch112/wallpaper-image"; // Replace with your repo
        const apiUrl = `https://api.github.com/repos/${repo}/contents/${category}`;

        const res = await fetch(apiUrl, {
          headers: { "User-Agent": "Cloudflare-Worker" }
        });

        const data = await res.json();

        // Filter only images
        images = data
          .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
          .map(f => f.download_url);

        if (!images.length) {
          return new Response("Category not found or empty", { status: 404 });
        }

        response = new Response(JSON.stringify(images), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600"
          }
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
}
