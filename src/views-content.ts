import { esc, layout } from "./views.ts";
import { LEGACY_PAGES } from "./content.ts";
import { BLOG_POSTS, type BlogPost } from "./blog.ts";

export function legacyPage(slug: string): string | null {
  const page = LEGACY_PAGES[slug];
  if (!page) return null;

  return layout({
    title: `${page.title} — Bond Auto Transport`,
    description: page.description,
    canonical: `/${slug}`,
    body: `
<section class="wrap section prose">
  <p class="eyebrow">Bond Auto Transport</p>
  <h1 class="page-title">${esc(page.title)}</h1>
  <p class="lede">${esc(page.intro)}</p>
  ${page.sections
    .map(
      (section) =>
        `<h2>${esc(section.heading)}</h2>${section.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}`,
    )
    .join("")}
  <div class="cta-row">
    <a class="btn btn-accent" href="/get-quote">Get your quote</a>
    <a class="btn btn-ghost" href="/contact">Contact dispatch</a>
  </div>
</section>`,
  });
}

function renderBlogParagraph(text: string): string {
  const isHeading = text.length < 90 && !/[.!?:]$/.test(text) && !text.startsWith(":");
  return isHeading ? `<h2>${esc(text)}</h2>` : `<p>${esc(text)}</p>`;
}

export function blogIndexPage(): string {
  return layout({
    title: "Car shipping blog — Bond Auto Transport",
    description: "Practical guides on vehicle shipping, pricing, inspections and carriers.",
    canonical: "/blog",
    body: `
<section class="wrap section">
  <p class="eyebrow">Blog</p>
  <h1 class="page-title">Car shipping guides & updates</h1>
  <p class="lede narrow">Practical guides on vehicle shipping, pricing, inspections and carriers.</p>
  <div class="cards">
    ${BLOG_POSTS.map(
      (post) =>
        `<a class="card" href="/post/${esc(post.slug)}">
          <h3>${esc(post.title)}</h3>
          <p class="muted small">${esc(post.date)} · ${esc(post.readTime)}</p>
          <p>${esc(post.description)}…</p>
        </a>`,
    ).join("")}
  </div>
</section>`,
  });
}

export function blogPostPage(post: BlogPost): string {
  return layout({
    title: `${post.title} — Bond Auto Transport`,
    description: post.description,
    canonical: `/post/${post.slug}`,
    body: `
<section class="wrap section prose">
  <p class="eyebrow">Blog</p>
  <h1 class="page-title">${esc(post.title)}</h1>
  <p class="muted small">${esc(post.date)} · ${esc(post.readTime)}</p>
  ${post.paragraphs.map(renderBlogParagraph).join("")}
  <div class="cta-row">
    <a class="btn btn-accent" href="/get-quote">Get your quote</a>
    <a class="btn btn-ghost" href="/blog">Back to the blog</a>
  </div>
</section>`,
  });
}
