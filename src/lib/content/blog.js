import { getCollection } from "astro:content";

/**
 * Published blog posts, newest first.
 * @returns {Promise<import('astro:content').CollectionEntry<'blog'>[]>}
 */
export async function getPublishedPosts() {
  const posts = await getCollection("blog", ({ data }) => data.draft !== true);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** @param {Date} date */
export function formatPostDate(date) {
  return date.toISOString().slice(0, 10);
}
